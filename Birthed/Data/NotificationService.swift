import Foundation
import Observation
import UserNotifications

/// Registering what `NotificationPlanner` worked out.
///
/// The split is deliberate. Deciding when a February 29 user should be told in
/// 2027 is a calendar question and lives in the domain, where it is tested.
/// This file only knows how to talk to the notification centre and what the
/// words say, and it has no arithmetic in it at all.
@Observable
final class NotificationService {
    enum Permission: Equatable {
        case unknown
        case notAsked
        case granted
        case denied
    }

    private(set) var permission: Permission = .unknown
    /// What is actually pending, for the settings screen to show rather than
    /// claim.
    private(set) var pendingCount: Int = 0

    /// The user's own switch, kept separately from the system permission.
    ///
    /// Two different questions. The operating system asks once and remembers
    /// forever; the user can want reminders off without wanting to revoke
    /// permission, and revoking permission in the system settings must not be
    /// silently re-enabled the next time the app opens.
    var isEnabled: Bool {
        didSet { defaults.set(isEnabled, forKey: Key.enabled) }
    }

    private enum Key { static let enabled = "birthed.reminders.v1" }

    /// The notification the user most recently tapped, waiting to be acted
    /// on. `RootView` reads it, opens the right screen, and sets it back to
    /// nil. Tapping "It is Sarah's birthday" opens the composer for Sarah;
    /// tapping the three day warning opens the People tab.
    var opened: PlannedNotification.Opened?

    private let centre: UNUserNotificationCenter
    private let planner: NotificationPlanner
    private let defaults: UserDefaults
    /// Held strongly, because the centre's `delegate` is weak.
    private var taps: NotificationTapHandler?

    init(
        centre: UNUserNotificationCenter = .current(),
        planner: NotificationPlanner = NotificationPlanner(),
        defaults: UserDefaults = .standard
    ) {
        self.centre = centre
        self.planner = planner
        self.defaults = defaults
        // On by default only once permission exists. Nothing is scheduled and
        // nothing is asked for until the user turns the switch on.
        self.isEnabled = defaults.object(forKey: Key.enabled) as? Bool ?? true

        // Set here, during launch, because a tap that started the app cold is
        // delivered as soon as a delegate exists and dropped if none does.
        let taps = NotificationTapHandler { [weak self] identifier in
            Task { @MainActor in
                self?.opened = PlannedNotification.opened(fromIdentifier: identifier)
            }
        }
        self.taps = taps
        centre.delegate = taps
    }

    // MARK: Permission

    func refresh() async {
        let settings = await centre.notificationSettings()
        switch settings.authorizationStatus {
        case .notDetermined:
            permission = .notAsked
        case .denied:
            permission = .denied
        case .authorized, .provisional, .ephemeral:
            permission = .granted
        @unknown default:
            permission = .unknown
        }
        pendingCount = await centre.pendingNotificationRequests().count
    }

    /// `FR-070`. Only ever called from a control the user tapped, never on
    /// launch and never during onboarding.
    @discardableResult
    func askPermission() async -> Bool {
        let granted = (try? await centre.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        permission = granted ? .granted : .denied
        return granted
    }

    // MARK: Scheduling

    /// Replaces everything pending with the current plan.
    ///
    /// Clearing first rather than diffing, because the whole plan is cheap to
    /// rebuild and a diff is a second place for the schedule to be wrong. The
    /// identifiers are stable anyway, so adding the same request twice would
    /// replace rather than duplicate; the clear is what removes a person the
    /// user has since deleted.
    func reschedule(birthday: CalendarBirthday, people: [Person], now: Date = Date()) async {
        await refresh()
        guard isEnabled, permission == .granted else {
            centre.removeAllPendingNotificationRequests()
            pendingCount = 0
            return
        }

        let plan = planner.plan(for: birthday, people: people, from: now)
        // uniquingKeysWith rather than uniqueKeysWithValues, which traps on a
        // duplicate identifier. Nothing should produce two people with the
        // same one, and a crash is not the right way to find out.
        // The whole person rather than just their name, because how their day
        // is worded depends on more than what they are called.
        let known = Dictionary(people.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })

        centre.removeAllPendingNotificationRequests()

        for notification in plan {
            guard let content = content(for: notification, birthday: birthday, people: known) else {
                continue
            }
            let trigger = UNCalendarNotificationTrigger(
                dateMatching: notification.fireDate,
                repeats: false
            )
            let request = UNNotificationRequest(
                identifier: notification.identifier,
                content: content,
                trigger: trigger
            )
            try? await centre.add(request)
        }

        pendingCount = await centre.pendingNotificationRequests().count
    }

    /// Everything off, for the toggle and for account deletion.
    func cancelEverything() {
        centre.removeAllPendingNotificationRequests()
        pendingCount = 0
    }

    // MARK: Words

    /// Nil when there is nothing worth saying, which is how a person whose
    /// name has been emptied out stops producing a notification addressed to
    /// nobody.
    private func content(
        for notification: PlannedNotification,
        birthday: CalendarBirthday,
        people: [UUID: Person]
    ) -> UNNotificationContent? {
        let content = UNMutableNotificationContent()
        content.sound = .default

        switch notification.kind {
        case .ownBirthday:
            content.title = "Happy birthday"
            content.body = "\(birthday.date.displayName()) is yours. Open Birthed to see who else has it."

        case let .ownCountdown(days):
            content.title = "\(days) days"
            content.body = "\(birthday.date.displayName()) is \(days) days away."

        case let .personBirthday(personID):
            guard let person = people[personID], person.isUsable else { return nil }
            let name = person.trimmedName
            if person.isRemembered {
                // Somebody who has died. "Say something" is addressed to them,
                // and there is nobody to address. This is the one notification
                // in the app that has to be written for the reader alone.
                content.title = "Remembering \(name)"
                content.body = born(person)
            } else {
                content.title = "It is \(name)'s birthday"
                content.body = "Today. Say something."
            }

        case let .personSoon(personID, days):
            guard let person = people[personID], person.isUsable else { return nil }
            content.title = "\(person.trimmedName)'s birthday is in \(days) days"
            content.body = "Long enough to actually get something."
        }

        return content
    }

    /// "Born today in 1998", or just "Born today" when the year is not known.
    /// Never an age, and never a span: the notification says the fact and
    /// leaves the arithmetic alone.
    private func born(_ person: Person) -> String {
        guard let year = person.birthday.year else { return "Born today." }
        return "Born today in \(year)."
    }
}

/// Hands a tapped notification's identifier back to the main actor.
///
/// Its own object rather than the service itself, because the notification
/// centre calls its delegate from its own queue and everything in this target
/// is `MainActor` by default. This class is `nonisolated`, so its two methods
/// can be called from anywhere, and the only thing that crosses back to the
/// main actor is a `String`. The `UNNotificationResponse` never leaves the
/// callback, for the same reason the rest of this file avoids `await` on the
/// centre: it is not `Sendable`.
nonisolated final class NotificationTapHandler: NSObject, UNUserNotificationCenterDelegate {
    private let onOpen: @Sendable (String) -> Void

    init(onOpen: @escaping @Sendable (String) -> Void) {
        self.onOpen = onOpen
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        // Only the default action, which is the tap. Dismissing a banner is
        // not asking for anything.
        if response.actionIdentifier == UNNotificationDefaultActionIdentifier {
            onOpen(response.notification.request.identifier)
        }
        completionHandler()
    }

    /// A birthday that lands while the app is open still shows, because the
    /// user may be on another tab and would otherwise never see it.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .list, .sound])
    }
}
