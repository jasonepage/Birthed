import Foundation

/// The four numbers, and nothing else ever.
///
/// `docs/first-five-minutes.md` names four numbers and says not twenty. This
/// file is the whole of the measurement in the product, and the shape of it is
/// deliberate rather than minimal for its own sake.
///
/// **There is no analytics kit and there will not be one.** The privacy page
/// says the app contains no advertising and no third party code that reports
/// on you, and that promise is worth more than the flexibility an event stream
/// would buy. So there is no stream of events, no device identifier beyond the
/// random account token already in the keychain, no session, no screen names,
/// no timings, and nothing at all that could be joined to a person. There are
/// four totals, they ride along on the profile row the app already writes, and
/// the privacy page lists them.
///
/// **What that costs, written down so nobody is surprised later.** Totals
/// cannot answer a question that was not asked in advance. There are no
/// funnels, no cohorts, and no retention curve without more work, and old
/// numbers cannot be re-cut. For the four questions named in the document that
/// is a fair trade. Wanting more later is a real decision to reopen, and it
/// comes with rewriting the privacy page and meaning it.
///
/// Two of the four need to be remembered between launches, so they live here.
/// The other two are read at the moment of the push from state the app already
/// holds: how many people are on the list, and whether iOS has granted
/// permission. Neither needs storing and neither is a history.
///
/// Deleting the app resets these, which is correct: deleting the app is
/// supposed to remove everything, and the privacy page says so.
enum Tally {

    private enum Key {
        static let remindersDelivered = "birthed.counts.remindersDelivered"
        static let messagesSent = "birthed.counts.messagesSent"
        /// Identifier to fire date for the reminders currently scheduled, so
        /// deliveries can be counted without asking iOS what is sitting in
        /// Notification Centre.
        static let scheduled = "birthed.counts.scheduled"
    }

    private static var defaults: UserDefaults { .standard }

    /// How many reminders this phone has actually reached the moment of.
    static var remindersDelivered: Int { defaults.integer(forKey: Key.remindersDelivered) }

    /// How many messages went through Messages after one.
    static var messagesSent: Int { defaults.integer(forKey: Key.messagesSent) }

    /// One message sent, counted at the only place in the app that can know.
    ///
    /// `MFMessageComposeViewController` reports whether its message was sent,
    /// cancelled or failed, and this counts the sent ones. A comment used to
    /// sit over that delegate saying whether the text went is between the user
    /// and Messages and Birthed does not record it. That is now half true and
    /// the half matters: the count is recorded, the message is not. No
    /// recipient, no words, no time, no person. A number.
    ///
    /// **It undercounts, on purpose, and the number must be read knowing it.**
    /// A message sent through the share sheet instead of Messages is invisible
    /// here, because `ShareLink` reports nothing back, and so is a friend
    /// texted from their own Messages thread after the reminder reminded them.
    /// So messages sent for every reminder delivered is a floor rather than a
    /// rate. If the floor is already good the product works. If the floor is
    /// low, that is a reason to measure better, not a reason to conclude
    /// nothing happened.
    static func noteMessageSent() {
        defaults.set(messagesSent + 1, forKey: Key.messagesSent)
    }

    /// Called every time the schedule is rebuilt, which is every foreground.
    ///
    /// Counting deliveries by asking iOS what is in Notification Centre would
    /// undercount every time somebody swipes their notifications away, and the
    /// people most likely to do that are the people most likely to have acted
    /// on one. So delivery is counted from the schedule instead: a reminder
    /// whose fire time has passed is one iOS was asked to show and had every
    /// reason to.
    ///
    /// The map is replaced rather than merged, and only future reminders are
    /// carried into it, which is what stops a reminder that has passed but is
    /// still in the plan being counted on every foreground for the rest of the
    /// day.
    ///
    /// A revoked permission clears the plan, and this is called with an empty
    /// one in that case. That is right: reminders that had already fired are
    /// counted, and reminders that will now never fire are dropped.
    ///
    /// The fire time is date components with no time zone, by the decision in
    /// `CLAUDE.md`, so resolving it here reads the phone's current zone, which
    /// is the same thing iOS does at fire time. A reminder counted while the
    /// reader is mid flight could be an hour out. It is a count, not a clock.
    static func noteScheduled(
        _ plan: [PlannedNotification],
        now: Date = Date(),
        calendar: Calendar = .current
    ) {
        let previous = defaults.dictionary(forKey: Key.scheduled) as? [String: Date] ?? [:]
        let passed = previous.values.filter { $0 <= now }.count
        if passed > 0 {
            defaults.set(remindersDelivered + passed, forKey: Key.remindersDelivered)
        }

        var next: [String: Date] = [:]
        for notification in plan {
            guard let date = calendar.date(from: notification.fireDate), date > now else { continue }
            next[notification.identifier] = date
        }
        defaults.set(next, forKey: Key.scheduled)
    }

    #if DEBUG
    /// So the rehearsal in Settings does not leave a phone claiming reminders
    /// it fired at itself twelve seconds apart.
    static func reset() {
        defaults.removeObject(forKey: Key.remindersDelivered)
        defaults.removeObject(forKey: Key.messagesSent)
        defaults.removeObject(forKey: Key.scheduled)
    }
    #endif
}

/// The four numbers as they are sent, which is as four numbers.
///
/// Every one of them is about this account's own use of the app. None of them
/// carries a name, a date, a note, a person, or anything that could be joined
/// to one. `peopleAdded` is the length of the people list and not the list:
/// "this account has seven people on it" says nothing about who they are, so
/// the promise that the people list stays on the phone survives it whole.
struct ProfileCounts: Equatable {
    let peopleAdded: Int
    let notificationPermissionGranted: Bool
    let remindersDelivered: Int
    let messagesSent: Int

    /// Read at the moment of the push. Two of these are held by `Tally` and
    /// two are read from what the app already knows.
    static func current(peopleAdded: Int, permissionGranted: Bool) -> ProfileCounts {
        ProfileCounts(
            peopleAdded: peopleAdded,
            notificationPermissionGranted: permissionGranted,
            remindersDelivered: Tally.remindersDelivered,
            messagesSent: Tally.messagesSent
        )
    }
}
