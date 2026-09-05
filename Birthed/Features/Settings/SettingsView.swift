import SwiftUI

/// Settings, as a sheet behind a cog.
///
/// This used to be a third tab called Me. A tab is a place you go; settings is
/// a thing you do once and leave. Giving it a third of the bottom bar told
/// every user that a third of this app is a form.
struct SettingsView: View {
    @Environment(ProfileStore.self) private var profileStore
    @Environment(AccountService.self) private var account
    @Environment(\.dismiss) private var dismiss

    @State private var editingBirthday = false
    @State private var editingRegion = false
    @State private var confirmingDelete = false
    @State private var showingAttributions = false
    @State private var region = ""

    private var profile: Profile? { profileStore.profile }

    var body: some View {
        NavigationStack {
            List {
                if let profile {
                    Section("Your day") {
                        LabeledContent("Birthday", value: profile.birthday.date.displayName())
                        LabeledContent("Year", value: profile.birthday.year.map { String($0) } ?? "Not set")
                        if profile.birthday.isLeapDay {
                            LabeledContent(
                                "Observed",
                                value: profile.birthday.leapObservance == .february28 ? "February 28" : "March 1"
                            )
                        }
                        Button("Change") { editingBirthday = true }
                    }

                    Section {
                        LabeledContent("Region", value: profile.regionCode ?? "Not set")
                        Button("Change") {
                            region = profile.regionCode ?? ""
                            editingRegion = true
                        }
                    } header: {
                        Text("Location")
                    } footer: {
                        Text("Birthed never receives your exact location.")
                    }
                }

                Section {
                    Button("Sources and licences") { showingAttributions = true }
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
                    Button("Done") { dismiss() }
                }
            }
            .sheet(isPresented: $editingBirthday) { birthdaySheet }
            .sheet(isPresented: $editingRegion) { regionSheet }
            .sheet(isPresented: $showingAttributions) { AttributionsView() }
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

    // MARK: Sheets

    private var birthdaySheet: some View {
        BirthdayEditor(profile: profile) { updated in
            profileStore.save(updated)
            Task { await account.pushProfile(updated) }
            editingBirthday = false
        } onCancel: {
            editingBirthday = false
        }
    }

    private var regionSheet: some View {
        NavigationStack {
            Form {
                TextField("97301, or Salem, Oregon", text: $region)
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled()
            }
            .navigationTitle("Region")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { editingRegion = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        guard var updated = profile else { return }
                        let trimmed = region.trimmingCharacters(in: .whitespacesAndNewlines)
                        updated.regionCode = trimmed.isEmpty ? nil : trimmed
                        profileStore.save(updated)
                        Task { await account.pushProfile(updated) }
                        editingRegion = false
                    }
                }
            }
        }
    }

    private func deleteEverything() async {
        try? await account.deleteEverything()
        profileStore.clear()
        dismiss()
    }
}

/// The birthday picker again, in a sheet. `FR-008` and `FR-009`.
private struct BirthdayEditor: View {
    let profile: Profile?
    let onSave: (Profile) -> Void
    let onCancel: () -> Void

    @State private var month: Int
    @State private var day: Int
    @State private var year: Int?
    @State private var observance: LeapObservance

    init(profile: Profile?, onSave: @escaping (Profile) -> Void, onCancel: @escaping () -> Void) {
        self.profile = profile
        self.onSave = onSave
        self.onCancel = onCancel
        _month = State(initialValue: profile?.birthday.date.month ?? 1)
        _day = State(initialValue: profile?.birthday.date.day ?? 1)
        _year = State(initialValue: profile?.birthday.year)
        _observance = State(initialValue: profile?.birthday.leapObservance ?? .february28)
    }

    private let years: [Int] = {
        let thisYear = Calendar(identifier: .gregorian).component(.year, from: Date())
        return Array((thisYear - 110)...thisYear).reversed()
    }()

    var body: some View {
        NavigationStack {
            Form {
                Section("Date") {
                    BirthdayPicker(month: $month, day: $day, observance: $observance)
                }
                Section("Year") {
                    Picker("Year", selection: $year) {
                        Text("Rather not say").tag(Int?.none)
                        ForEach(years, id: \.self) { value in
                            Text(String(value)).tag(Int?.some(value))
                        }
                    }
                }
            }
            .navigationTitle("Your birthday")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: onCancel)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        guard let date = CalendarDate(month: month, day: day) else { return }
                        var updated = profile ?? Profile(
                            birthday: CalendarBirthday(date: date), regionCode: nil
                        )
                        updated.birthday = CalendarBirthday(
                            date: date, year: year, leapObservance: observance
                        )
                        onSave(updated)
                    }
                }
            }
        }
    }
}

extension Bundle {
    var shortVersion: String {
        (infoDictionary?["CFBundleShortVersionString"] as? String) ?? "1.0"
    }
}
