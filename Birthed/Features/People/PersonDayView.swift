import SwiftUI

/// Somebody's own day: everything Mine says about the reader, said about a
/// person on their list.
///
/// Their date, the day of the week they were born, how many days old they
/// are, how far apart the two of you are, the number one song the week they
/// were born, who famous shares the birthday, and the best thing the editor
/// kept about the date.
///
/// Nothing about the person leaves the phone. Every read here is a read of a
/// date, the same public tables the Today tab reads when a reader browses to
/// any day, and nothing here ever starts a search.
struct PersonDayView: View {
    let personID: Person.ID
    /// Used until the store answers, and if the person is removed while this
    /// screen is open.
    let fallback: Person
    let repository: DayPageRepository

    @Environment(PeopleStore.self) private var store
    @Environment(ProfileStore.self) private var profileStore
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.openURL) private var openURL

    @State private var song: ChartWeek?
    @State private var twins: [NotablePerson] = []
    @State private var fact: BirthFact?
    @State private var preview = PreviewPlayer()
    @State private var editing = false
    @State private var saying = false

    private let calendar = BirthdayCalendar()
    private let stage = StagePalette.wax
    private var palette: StagePalette { .forScheme(colorScheme) }
    private var now: Date { Date() }

    private var person: Person { store.people.first { $0.id == personID } ?? fallback }
    private var short: String { PersonDay.shortName(person.trimmedName) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                panel
                if let song { songCard(song) }
                if !twins.isEmpty { twinsCard }
                if let fact { factCard(fact) }
                sayButton
                    .padding(.top, 6)
            }
            .padding(.horizontal, 18)
            .padding(.top, 6)
        }
        .contentMargins(.bottom, 80, for: .scrollContent)
        .background(palette.ground.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Edit") { editing = true }
            }
        }
        .task(id: person.birthday) { await load() }
        .onDisappear { preview.stop() }
        .sheet(isPresented: $editing) {
            PersonEditor(person: person) { store.update($0); editing = false } onCancel: { editing = false }
        }
        .sheet(isPresented: $saying) {
            if person.isPublicFigure {
                ShareCardPicker(
                    choices: [FigureCard.shareChoice(for: person, reader: profileStore.profile?.birthday)],
                    subject: person.trimmedName
                )
            } else {
                SaySomethingView(person: person)
            }
        }
    }

    // MARK: The panel

    private var panel: some View {
        let days = calendar.daysUntil(person.birthday, from: now)
        let bornOn = calendar.birthWeekday(person.birthday).flatMap { PersonDay.weekdayName($0) }
        return VStack(alignment: .leading, spacing: 0) {
            Text(person.isRemembered ? "REMEMBERING" : "\(PersonDay.possessive(person.trimmedName).uppercased()) DAY")
                .font(.caption.weight(.heavy))
                .kerning(2.8)
                .foregroundStyle(stage.accent)

            Text(person.birthday.date.displayName())
                .font(.system(size: 34, weight: .heavy, design: .serif))
                .foregroundStyle(stage.type)
                .padding(.top, 8)

            Text(bornLineText(bornOn))
                .font(.system(size: 15))
                .foregroundStyle(stage.type.opacity(0.6))
                .padding(.top, 2)

            HStack(spacing: 10) {
                if let alive = calendar.daysAlive(person.birthday, on: now), !person.isRemembered {
                    stat(alive.formatted(), "days old")
                }
                stat(days == 0 ? "Today" : String(days), days == 0 ? "is the day" : (days == 1 ? "day to go" : "days to go"))
            }
            .padding(.top, 14)

            if let gap = PersonDay.ageGap(name: short, theirs: person.birthday, reader: profileStore.profile?.birthday) {
                Text(gapText(gap))
                    .font(.system(size: 16))
                    .foregroundStyle(stage.type.opacity(0.9))
                    .padding(.top, 14)
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            ZStack {
                stage.ground
                RadialGradient(colors: [Theme.honey.opacity(0.24), .clear],
                               center: UnitPoint(x: 0.85, y: 0.1), startRadius: 0, endRadius: 320)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).strokeBorder(HivePalette.cellEdge, lineWidth: 1))
    }

    private func bornLineText(_ bornOn: String?) -> String {
        switch (bornOn, person.birthday.year) {
        case let (day?, year?): return "born on a \(day), \(String(year))"
        case let (nil, year?): return "born in \(String(year))"
        default: return "no birth year saved"
        }
    }

    /// The number in the sentence in honey, the way the mockup sets it.
    private func gapText(_ sentence: String) -> AttributedString {
        var text = AttributedString(sentence)
        if let range = sentence.range(of: #"\d+"#, options: .regularExpression),
           let attributed = text.range(of: String(sentence[range])) {
            text[attributed].foregroundColor = stage.accent
            text[attributed].font = Font.system(size: 16, weight: .bold)
        }
        return text
    }

    private func stat(_ number: String, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(number)
                .font(.system(size: 22, weight: .black, design: .serif))
                .foregroundStyle(stage.type)
                .monospacedDigit()
            Text(label)
                .font(.caption)
                .foregroundStyle(stage.type.opacity(0.55))
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(stage.type.opacity(0.06), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    // MARK: The cards

    private func card<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10, content: content)
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(HivePalette.cell, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(HivePalette.cellEdge, lineWidth: 1))
    }

    private func kicker(_ text: String, color: Color) -> some View {
        Text(text)
            .font(.caption.weight(.heavy))
            .kerning(2.4)
            .foregroundStyle(color)
            .fixedSize(horizontal: false, vertical: true)
    }

    private func songCard(_ song: ChartWeek) -> some View {
        card {
            // The song keeps the one pink kicker, the same as on Mine.
            kicker("NUMBER ONE THE WEEK \(short.uppercased()) WAS BORN", color: Theme.spark)
            HStack(spacing: 12) {
                cover(song)
                VStack(alignment: .leading, spacing: 3) {
                    Text(song.song)
                        .font(.system(size: 19, weight: .heavy, design: .serif))
                        .foregroundStyle(HivePalette.cellType)
                        .lineLimit(2)
                        .minimumScaleFactor(0.7)
                    Text(song.artist)
                        .font(.footnote)
                        .foregroundStyle(HivePalette.cellDim)
                        .lineLimit(1)
                }
            }
        }
    }

    private func cover(_ song: ChartWeek) -> some View {
        ZStack {
            AsyncImage(url: song.artworkURL) { phase in
                if case let .success(image) = phase {
                    image.resizable().aspectRatio(contentMode: .fill)
                } else {
                    LinearGradient(colors: [Color(red: 0.42, green: 0.29, blue: 0.16), HivePalette.cell],
                                   startPoint: .topLeading, endPoint: .bottomTrailing)
                }
            }
            if song.previewURL != nil {
                Circle().fill(.black.opacity(0.42)).frame(width: 28, height: 28)
                Image(systemName: preview.nowPlaying == song.previewURL ? "pause.fill" : "play.fill")
                    .font(.system(size: 12, weight: .black))
                    .foregroundStyle(.white)
            }
        }
        .frame(width: 58, height: 58)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .contentShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .onTapGesture {
            if let sample = song.previewURL {
                preview.toggle(sample)
            } else if let store = song.storeURL {
                openURL(store)
            }
        }
        .accessibilityLabel(song.previewURL != nil ? "Play a sample" : "Open on Apple Music")
        .accessibilityAddTraits(.isButton)
    }

    private var twinsCard: some View {
        card {
            kicker("SHARES THE BIRTHDAY", color: Theme.honey)
            FlowRow(spacing: 8) {
                ForEach(twins) { twin in
                    HStack(spacing: 5) {
                        Text(twin.name)
                            .foregroundStyle(HivePalette.cellType)
                        if let year = twin.birthYear {
                            Text(String(year))
                                .foregroundStyle(HivePalette.cellDim)
                        }
                    }
                    .font(.footnote)
                    .lineLimit(1)
                    .padding(.horizontal, 11)
                    .padding(.vertical, 6)
                    .background(Color(red: 0.165, green: 0.125, blue: 0.086), in: Capsule())
                    .overlay(Capsule().strokeBorder(HivePalette.cellEdge, lineWidth: 1))
                }
            }
        }
    }

    private func factCard(_ fact: BirthFact) -> some View {
        card {
            kicker("ON \(person.birthday.date.displayName().uppercased())", color: Theme.honey)
            Text(fact.fact)
                .font(.system(size: 17, weight: .bold, design: .serif))
                .foregroundStyle(HivePalette.cellType)
                .fixedSize(horizontal: false, vertical: true)
            if let source = fact.sourceURL {
                Button {
                    openURL(source)
                } label: {
                    Text("Picked by the editor \u{00B7} \(source.host() ?? "source") \u{2197}")
                        .font(.caption)
                        .foregroundStyle(HivePalette.cellDim)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var sayButton: some View {
        Button { saying = true } label: {
            Text(person.isPublicFigure ? "Share a card" : "Say something")
                .font(.system(size: 17, weight: .heavy))
                .foregroundStyle(HivePalette.buzzInk)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 15)
                .background(
                    LinearGradient(colors: [HivePalette.buzzTop, HivePalette.buzzBottom],
                                   startPoint: .top, endPoint: .bottom),
                    in: Capsule()
                )
        }
        .buttonStyle(.plain)
    }

    // MARK: Reading the date

    /// Three reads of the date, each allowed to fail on its own: a card that
    /// did not load is a card that is not drawn.
    private func load() async {
        let date = person.birthday.date
        if let year = person.birthday.year {
            song = (try? await repository.numberOneSong(theWeekOf: date, birthYear: year)) ?? nil
        } else {
            song = nil
        }
        let found = (try? await repository.notablePeople(bornOn: date, limit: 8)) ?? []
        let own = person.trimmedName.lowercased()
        twins = Array(found.filter { $0.name.lowercased() != own }.prefix(3))
        let facts = (try? await repository.birthFacts(on: date, limit: 30)) ?? []
        fact = facts.max { ($0.interest ?? 0, -$0.id) < ($1.interest ?? 0, -$1.id) }
    }
}

/// A row of chips that wraps onto the next line when it runs out of room.
private struct FlowRow: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, line: CGFloat = 0, widest: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0, x + size.width > width {
                y += line + spacing
                x = 0
                line = 0
            }
            x += size.width + spacing
            line = max(line, size.height)
            widest = max(widest, x - spacing)
        }
        return CGSize(width: proposal.width ?? widest, height: y + line)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, line: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > bounds.minX, x + size.width > bounds.maxX {
                y += line + spacing
                x = bounds.minX
                line = 0
            }
            subview.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            line = max(line, size.height)
        }
    }
}
