import SwiftUI
import UIKit

/// Settings, in the app's own look.
///
/// Redrawn on September 22, 2026. It was a stock grouped list with a paragraph
/// under every section, the one screen left that looked like a form rather
/// than like Birthed. Now: your day at the top on the honey panel, the three
/// things a person actually changes as short rows, and the long explanations
/// cut to one line each. Nothing was removed; the rehearsal harness is still
/// here in debug builds.
struct SettingsView: View {
    var onReplayReveal: (() -> Void)? = nil

    @Environment(ProfileStore.self) private var profileStore
    @Environment(AccountService.self) private var account
    @Environment(PeopleStore.self) private var peopleStore
    @Environment(NotificationService.self) private var notifications
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @Environment(\.colorScheme) private var colorScheme

    @State private var confirmingDelete = false
    @State private var region = ""
    @FocusState private var regionFocused: Bool

    #if DEBUG
    @State private var rehearsal = ""
    #endif

    private var profile: Profile? { profileStore.profile }
    private var palette: StagePalette { .forScheme(colorScheme) }
    private let stage = StagePalette.wax
    private let calendar = BirthdayCalendar()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    if let profile {
                        dayPanel(profile)
                    }

                    group("REMINDERS", note: reminderNote) {
                        remindersRow
                    }

                    if profile != nil {
                        group("REGION", note: "Only for facts about where you were born. Your phone's location is never used.") {
                            regionRow
                        }
                    }

                    group("ABOUT", note: accountNote) {
                        NavigationLink {
                            AttributionsView()
                        } label: {
                            row(icon: "text.book.closed", title: "Sources and licences") {
                                chevron
                            }
                        }
                        .buttonStyle(.plain)
                        divider
                        row(icon: "info.circle", title: "Version") {
                            Text(Bundle.main.shortVersion)
                                .foregroundStyle(palette.type.opacity(0.5))
                        }
                    }

                    #if DEBUG
                    rehearsalGroup
                    #endif

                    Button {
                        confirmingDelete = true
                    } label: {
                        Text("Delete my account and data")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.red.opacity(0.85))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 4)
                }
                .padding(.horizontal, 18)
                .padding(.top, 6)
                .padding(.bottom, 30)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(palette.ground.ignoresSafeArea())
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        commitRegion()
                        dismiss()
                    }
                }
            }
            .onAppear { region = profile?.regionCode ?? "" }
            .task { await notifications.refresh() }
            .confirmationDialog(
                "Delete everything?",
                isPresented: $confirmingDelete,
                titleVisibility: .visible
            ) {
                Button("Delete", role: .destructive) {
                    Task { await deleteEverything() }
                }
                Button("Keep it", role: .cancel) {}
            } message: {
                Text("This removes your account and everything stored with it. It cannot be undone.")
            }
        }
        .tint(Theme.accent)
    }

    // MARK: Your day

    /// The one thing in Settings that is about you, set the way Mine sets it.
    /// A tap on the date edits it; the reveal is one button under it.
    private func dayPanel(_ profile: Profile) -> some View {
        let weekday = calendar.birthWeekday(profile.birthday).flatMap { PersonDay.weekdayName($0) }
        let alive = calendar.daysAlive(profile.birthday, on: Date())
        return VStack(alignment: .leading, spacing: 0) {
            Text("YOUR DAY")
                .font(.caption.weight(.heavy))
                .kerning(2.8)
                .foregroundStyle(stage.accent)

            NavigationLink {
                BirthdayEditor(profile: profile) { save($0) }
            } label: {
                HStack(alignment: .firstTextBaseline) {
                    Text(birthdayLine(profile))
                        .font(.system(size: 30, weight: .heavy, design: .serif))
                        .foregroundStyle(stage.type)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                    Spacer(minLength: 8)
                    Text("Edit")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(stage.accent)
                }
            }
            .buttonStyle(.plain)
            .padding(.top, 8)

            Text(dayDetail(weekday: weekday, alive: alive))
                .font(.subheadline)
                .foregroundStyle(stage.type.opacity(0.6))
                .padding(.top, 4)

            if let onReplayReveal {
                Button {
                    commitRegion()
                    dismiss()
                    onReplayReveal()
                } label: {
                    Label("Play the reveal again", systemImage: "play.fill")
                        .font(.subheadline.weight(.heavy))
                        .foregroundStyle(HivePalette.buzzInk)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(
                            LinearGradient(colors: [HivePalette.buzzTop, HivePalette.buzzBottom],
                                           startPoint: .top, endPoint: .bottom),
                            in: Capsule()
                        )
                }
                .buttonStyle(.plain)
                .padding(.top, 16)
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            ZStack {
                stage.ground
                RadialGradient(colors: [Theme.honey.opacity(0.22), .clear],
                               center: UnitPoint(x: 0.9, y: 0.05), startRadius: 0, endRadius: 300)
            }
        }
        .overlay(alignment: .bottomTrailing) {
            CandleMark(height: 64, on: stage)
                .padding(.trailing, 24)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
        }
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).strokeBorder(HivePalette.cellEdge, lineWidth: 1))
    }

    private func dayDetail(weekday: String?, alive: Int?) -> String {
        switch (weekday, alive) {
        case let (day?, days?): return "Born on a \(day) \u{00B7} \(days.formatted()) days old"
        case let (day?, nil): return "Born on a \(day)"
        default: return "Add your year for the song and your age"
        }
    }

    // MARK: Rows

    private var remindersRow: some View {
        Group {
            if notifications.permission == .denied {
                Button {
                    if let url = URL(string: UIApplication.openSettingsURLString) {
                        openURL(url)
                    }
                } label: {
                    row(icon: "bell.slash", title: "Reminders") {
                        Text("Off in iOS Settings")
                            .foregroundStyle(palette.type.opacity(0.5))
                        chevron
                    }
                }
                .buttonStyle(.plain)
            } else {
                row(icon: "bell", title: "Reminders") {
                    Toggle("Reminders", isOn: Binding(
                        get: { notifications.isEnabled },
                        set: { wanted in Task { await setReminders(wanted) } }
                    ))
                    .labelsHidden()
                    .tint(Theme.accent)
                }
            }
        }
    }

    private var regionRow: some View {
        row(icon: "mappin.and.ellipse", title: "Where you were born") {
            TextField("Add a city", text: $region)
                .multilineTextAlignment(.trailing)
                .textInputAutocapitalization(.words)
                .autocorrectionDisabled()
                .focused($regionFocused)
                .submitLabel(.done)
                .foregroundStyle(palette.type.opacity(0.7))
                .onSubmit { commitRegion() }
                .onChange(of: regionFocused) { _, focused in
                    if !focused { commitRegion() }
                }
        }
    }

    /// A heading, a card of rows, and one line under it.
    private func group<Content: View>(_ heading: String, note: String?, @ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(heading)
                .font(.caption.weight(.heavy))
                .kerning(2.6)
                .foregroundStyle(palette.type.opacity(0.5))
                .padding(.leading, 6)
            VStack(spacing: 0, content: content)
                .background(palette.type.opacity(0.06), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(palette.type.opacity(0.08), lineWidth: 1))
            if let note {
                Text(note)
                    .font(.footnote)
                    .foregroundStyle(palette.type.opacity(0.5))
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, 6)
            }
        }
    }

    private func row<Trailing: View>(icon: String, title: String, @ViewBuilder trailing: () -> Trailing) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(palette.accent)
                .frame(width: 30, height: 30)
                .background(palette.accent.opacity(0.14), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            Text(title)
                .font(.body)
                .foregroundStyle(palette.type)
                .lineLimit(1)
            Spacer(minLength: 8)
            trailing()
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 11)
        .contentShape(Rectangle())
    }

    private var chevron: some View {
        Image(systemName: "chevron.right")
            .font(.footnote.weight(.semibold))
            .foregroundStyle(palette.type.opacity(0.3))
    }

    private var divider: some View {
        Rectangle()
            .fill(palette.type.opacity(0.08))
            .frame(height: 1)
            .padding(.leading, 56)
    }

    // MARK: The words under the rows, one line each

    private var reminderNote: String {
        switch notifications.permission {
        case .denied:
            return "iOS is holding these back. Turn them on again in the iOS Settings app."
        case .granted where notifications.isEnabled:
            return "Your birthday morning, and everyone you added, on the day and three days before."
        case .granted:
            return "Nothing is scheduled."
        case .notAsked, .unknown:
            return "Your birthday morning, and everyone you added, on the day and three days before. iOS asks once."
        }
    }

    private var accountNote: String {
        switch account.state {
        case .signedIn:
            return "Birthed made you an account on first launch. No password, nothing to sign in to."
        case .unknown:
            return "Setting up your account."
        case .unavailable:
            return "No account yet. Everything stays on this phone and Birthed tries again."
        }
    }

    // MARK: Rehearsal, debug builds only

    #if DEBUG
    private var rehearsalGroup: some View {
        let soonest = BirthdayAgenda().soonestFirst(peopleStore.people, on: Date()).filter(\.isUsable)
        let friend = soonest.first { !$0.isPublicFigure }

        return group("REHEARSE A REMINDER", note: rehearsal.isEmpty ? Self.rehearsalHelp : rehearsal) {
            if let profile {
                if let friend {
                    debugButton("It is \(friend.trimmedName)'s birthday") {
                        fire(.personBirthday(personID: friend.id), profile)
                    }
                    divider
                    debugButton("\(friend.trimmedName)'s birthday is in \(notifications.personDaysBefore) days") {
                        fire(.personSoon(personID: friend.id, daysBefore: notifications.personDaysBefore), profile)
                    }
                    divider
                }
                debugButton("Your own birthday morning") {
                    fire(.ownBirthday, profile)
                }
                divider
            }
            debugButton("Reset the four numbers", destructive: true) {
                Tally.reset()
                rehearsal = "Reminders delivered and messages sent are back to zero on this phone. The next foreground sends the zeros."
            }
        }
    }

    private func debugButton(_ title: String, destructive: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline)
                .foregroundStyle(destructive ? Color.red.opacity(0.85) : palette.accent)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private static let rehearsalHelp = """
        Debug builds only. Fires one reminder from the real plan twelve \
        seconds from now, with the real words, so tapping it walks the \
        shipping path. Lock the phone after you tap. Public figures get no \
        reminders, so only friends are offered.
        """

    private func fire(_ kind: PlannedNotification.Kind, _ profile: Profile) {
        rehearsal = "Asking iOS..."
        Task {
            rehearsal = await notifications.rehearse(
                kind,
                birthday: profile.birthday,
                people: peopleStore.people
            )
        }
    }
    #endif

    // MARK: Saving

    private func setReminders(_ wanted: Bool) async {
        guard wanted else {
            notifications.isEnabled = false
            notifications.cancelEverything()
            return
        }
        if notifications.permission != .granted {
            let granted = await notifications.askPermission()
            guard granted else { return }
        }
        notifications.isEnabled = true
        guard let profile else { return }
        await notifications.reschedule(birthday: profile.birthday, people: peopleStore.people)
    }

    private func birthdayLine(_ profile: Profile) -> String {
        var line = profile.birthday.date.displayName()
        if let year = profile.birthday.year { line += ", \(year)" }
        return line
    }

    private func commitRegion() {
        guard var updated = profile else { return }
        let trimmed = region.trimmingCharacters(in: .whitespacesAndNewlines)
        let value = trimmed.isEmpty ? nil : trimmed
        guard value != updated.regionCode else { return }
        updated.regionCode = value
        save(updated)
    }

    private func save(_ updated: Profile) {
        profileStore.save(updated)
        Task { await account.pushProfile(updated) }
    }

    private func deleteEverything() async {
        try? await account.deleteEverything()
        notifications.cancelEverything()
        profileStore.clear()
        dismiss()
    }
}

private struct BirthdayEditor: View {
    let profile: Profile
    let onChange: (Profile) -> Void

    @State private var month: Int
    @State private var day: Int
    @State private var year: Int?
    @State private var observance: LeapObservance

    init(profile: Profile, onChange: @escaping (Profile) -> Void) {
        self.profile = profile
        self.onChange = onChange
        _month = State(initialValue: profile.birthday.date.month)
        _day = State(initialValue: profile.birthday.date.day)
        _year = State(initialValue: profile.birthday.year)
        _observance = State(initialValue: profile.birthday.leapObservance)
    }

    private let years: [Int] = {
        let thisYear = Calendar(identifier: .gregorian).component(.year, from: Date())
        return Array((thisYear - 110)...thisYear).reversed()
    }()

    var body: some View {
        Form {
            Section("Date") {
                BirthdayPicker(month: $month, day: $day, observance: $observance)
            }
            Section {
                Picker("Year", selection: $year) {
                    Text("Rather not say").tag(Int?.none)
                    ForEach(years, id: \.self) { value in
                        Text(String(value)).tag(Int?.some(value))
                    }
                }
            } header: {
                Text("Year")
            } footer: {
                Text("Optional. It turns on the number one song the week you were born, and the age you are turning.")
            }
        }
        .navigationTitle("Your birthday")
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: month) { _, _ in commit() }
        .onChange(of: day) { _, _ in commit() }
        .onChange(of: year) { _, _ in commit() }
        .onChange(of: observance) { _, _ in commit() }
    }

    private func commit() {
        guard let date = CalendarDate(month: month, day: day) else { return }
        var updated = profile
        updated.birthday = CalendarBirthday(date: date, year: year, leapObservance: observance)
        onChange(updated)
    }
}

extension Bundle {
    var shortVersion: String {
        (infoDictionary?["CFBundleShortVersionString"] as? String) ?? "1.0"
    }
}
