import SwiftUI

/// Adding or changing somebody. The same picker onboarding uses, so February 29
/// works here too and gets asked the same question.
struct PersonEditor: View {
    let person: Person?
    let onSave: (Person) -> Void
    let onCancel: () -> Void

    @State private var name: String
    @State private var note: String
    @State private var month: Int
    @State private var day: Int
    @State private var year: Int?
    @State private var observance: LeapObservance
    @FocusState private var nameFocused: Bool

    init(person: Person?, onSave: @escaping (Person) -> Void, onCancel: @escaping () -> Void) {
        self.person = person
        self.onSave = onSave
        self.onCancel = onCancel
        _name = State(initialValue: person?.name ?? "")
        _note = State(initialValue: person?.note ?? "")
        _month = State(initialValue: person?.birthday.date.month ?? 1)
        _day = State(initialValue: person?.birthday.date.day ?? 1)
        _year = State(initialValue: person?.birthday.year)
        _observance = State(initialValue: person?.birthday.leapObservance ?? .february28)
    }

    private let years: [Int] = {
        let thisYear = Calendar(identifier: .gregorian).component(.year, from: Date())
        return Array((thisYear - 110)...thisYear).reversed()
    }()

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Name", text: $name)
                        .focused($nameFocused)
                        .textInputAutocapitalization(.words)
                    TextField("Note, like Mum or from school", text: $note)
                        .textInputAutocapitalization(.sentences)
                } footer: {
                    Text("The note is just for you, to tell two Sarahs apart.")
                }

                Section("Their day") {
                    BirthdayPicker(month: $month, day: $day, observance: $observance,
                                   showsChoice: true)
                }

                // No section header. The row is already called Year and
                // saying it twice is the screen talking to itself.
                Section {
                    Picker("Year", selection: $year) {
                        Text("Do not know").tag(Int?.none)
                        ForEach(years, id: \.self) { value in
                            Text(String(value)).tag(Int?.some(value))
                        }
                    }
                } footer: {
                    Text("Optional. Only used to say the age they are turning.")
                }
            }
            .navigationTitle(person == nil ? "Add someone" : person?.trimmedName ?? "Edit")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(person == nil ? "Cancel" : "Done") {
                        // Editing commits as you go, so the only thing left to
                        // do is leave. Adding can still be abandoned, because a
                        // half-typed name is not a person.
                        if person == nil { onCancel() } else { save() }
                    }
                }
                if person == nil {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Add", action: save).disabled(!canSave)
                    }
                }
            }
            .onAppear { if person == nil { nameFocused = true } }
        }
    }

    private func save() {
        guard let date = CalendarDate(month: month, day: day) else { return }
        let trimmedNote = note.trimmingCharacters(in: .whitespacesAndNewlines)
        // The identifier and the death year are carried through untouched.
        // The first version dropped both, so opening a followed person and
        // tapping Done turned them into somebody typed in: the follow sheet
        // offered them again, they gained a three day warning, and somebody
        // who had died would be wished a happy birthday next time round.
        onSave(Person(
            id: person?.id ?? UUID(),
            name: name.trimmingCharacters(in: .whitespacesAndNewlines),
            birthday: CalendarBirthday(date: date, year: year, leapObservance: observance),
            note: trimmedNote.isEmpty ? nil : trimmedNote,
            wikidataID: person?.wikidataID,
            deathYear: person?.deathYear
        ))
    }
}
