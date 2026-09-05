import SwiftUI

/// Settings, as a sheet behind a cog.
///
/// No "Change" buttons. A row that shows a value and does nothing when you tap
/// it, sitting above a button whose only job is to make that row work, is two
/// controls doing one control's job. The row is the control. Text you can edit
/// is edited in place and saved as you type.
struct SettingsView: View {
    @Environment(ProfileStore.self) private var profileStore
    @Environment(AccountService.self) private var account
    @Environment(\.dismiss) private var dismiss

    @State private var confirmingDelete = false
    @State private var region = ""
    @FocusState private var regionFocused: Bool

    private var profile: Profile? { profileStore.profile }

    var body: some View {
        NavigationStack {
            List {
                if let profile {
                    Section("Your day") {
                        NavigationLink {
                            BirthdayEditor(profile: profile) { save($0) }
                        } label: {
                            LabeledContent("Birthday", value: birthdayLine(profile))
                        }
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
                        Text("A postal code or a city. Birthed never receives your exact location.")
                    }
                }

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
                Text("Optional. Only used to work out the age you are turning.")
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
