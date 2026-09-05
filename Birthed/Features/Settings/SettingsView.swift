import SwiftUI
import UIKit

/// Settings, as a sheet behind a cog.
///
/// No "Change" buttons. A row that shows a value and does nothing when you tap
/// it, sitting above a button whose only job is to make that row work, is two
/// controls doing one control's job. The row is the control. Text you can edit
/// is edited in place and saved as you type.
struct SettingsView: View {
    /// Asked for when the person wants the opening reveal again. The root
    /// presents it, because it replaces the whole screen and this sheet has
    /// to go first.
    var onReplayReveal: (() -> Void)? = nil

    @Environment(ProfileStore.self) private var profileStore
    @Environment(AccountService.self) private var account
    @Environment(PeopleStore.self) private var peopleStore
    @Environment(NotificationService.self) private var notifications
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    @State private var confirmingDelete = false
    @State private var region = ""
    @FocusState private var regionFocused: Bool

    private var profile: Profile? { profileStore.profile }

    var body: some View {
        NavigationStack {
            List {
                if let profile {
                    Section {
                        NavigationLink {
                            BirthdayEditor(profile: profile) { save($0) }
                        } label: {
                            LabeledContent("Birthday", value: birthdayLine(profile))
                        }
                        if let onReplayReveal {
                            Button {
                                commitRegion()
                                dismiss()
                                onReplayReveal()
                            } label: {
                                Label("Play the reveal again", systemImage: "play.circle")
                            }
                        }
                    } header: {
                        Text("Your day")
                    } footer: {
                        Text("The reveal is the opening: the wheels, the day of the week, and what was number one the week you were born. Finishing it saves whatever the wheels say, so it is also a way to change your day.")
                    }

                    Section {
                        LabeledContent("Region") {
                            TextField("Add one", text: $region)
                                .multilineTextAlignment(.trailing)
                                .textInputAutocapitalization(.words)
                                .autocorrectionDisabled()
                                .focused($regionFocused)
                                .submitLabel(.done)
                                .onSubmit { commitRegion() }
                                .onChange(of: regionFocused) { _, focused in
                                    if !focused { commitRegion() }
                                }
                        }
                    } header: {
                        Text("Location")
                    } footer: {
                        Text("A postal code or a city, and it is the only location Birthed has. Your device's location is never used or sent.")
                    }
                }

                remindersSection

                Section {
                    NavigationLink("Sources and licences") { AttributionsView() }
                    LabeledContent("Version", value: Bundle.main.shortVersion)
                } header: {
                    Text("About")
                } footer: {
                    Text(accountFooter)
                }

                Section {
                    Button("Delete my account and data", role: .destructive) {
                        confirmingDelete = true
                    }
                }
            }
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

    /// One switch, and the row is the control. `FR-070` keeps the system
    /// prompt out of onboarding, so this is where it is asked for, from a
    /// thing the user deliberately touched.
    ///
    /// When permission has been refused there is no switch, because a switch
    /// that cannot do anything is a lie. There is a row that opens the place
    /// where it can be undone.
    @ViewBuilder
    private var remindersSection: some View {
        Section {
            if notifications.permission == .denied {
                Button {
                    if let url = URL(string: UIApplication.openSettingsURLString) {
                        openURL(url)
                    }
                } label: {
                    LabeledContent("Reminders", value: "Off in iOS Settings")
                }
                .tint(.primary)
            } else {
                Toggle("Reminders", isOn: Binding(
                    get: { notifications.isEnabled },
                    set: { wanted in Task { await setReminders(wanted) } }
                ))
            }
        } header: {
            Text("Reminders")
        } footer: {
            Text(reminderFooter)
        }
    }

    private var reminderFooter: String {
        switch notifications.permission {
        case .denied:
            return "iOS is holding these back. Turning them on again is done in the iOS Settings app."
        case .granted where notifications.isEnabled:
            return "Your birthday morning, a run up 45 days before, and every person you have added, on the day and three days before."
        case .granted:
            return "Nothing is scheduled."
        case .notAsked, .unknown:
            return "Your birthday morning, and the people you have added, on the day and three days before. iOS will ask you once."
        }
    }

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

    /// The account is silent by design, so its state is a footnote rather than
    /// a row demanding attention.
    private var accountFooter: String {
        switch account.state {
        case .signedIn:
            return "Birthed made an account for you silently on first launch. No password, nothing to sign in to."
        case .unknown:
            return "Setting up your account."
        case .unavailable:
            return "Your account has not been created yet. Birthed keeps everything on this device and will try again."
        }
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

/// Changing your own birthday. Pushed rather than presented, and it commits as
/// you turn the wheels: there is nothing to confirm and nothing to cancel,
/// because every state of this screen is a valid birthday.
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
                Text("Optional. It is what turns on the number one song the week you were born, and the age you are turning.")
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
