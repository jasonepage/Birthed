import SwiftUI

/// Your day: the countdown, and on the day itself, the day.
///
/// `FR-034` counts in whole local days. `FR-035` switches to a distinct state
/// on the birthday rather than showing a zero. `FR-036` says so out loud when
/// a February 29 birthday is being observed on another date.
struct MyDayView: View {
    let profile: Profile
    let repository: DayPageRepository
    let onOpenSettings: () -> Void

    @State private var twins: [NotablePerson] = []
    @State private var song: ChartWeek?
    @ScaledMetric(relativeTo: .largeTitle) private var heroSize: CGFloat = 128

    private let calendar = BirthdayCalendar()
    private var now: Date { Date() }

    private var isBirthday: Bool { calendar.isBirthdayToday(profile.birthday, on: now) }
    private var daysAway: Int { calendar.daysUntil(profile.birthday, from: now) }
    private var observed: CalendarDate {
        calendar.observedDate(for: profile.birthday,
                              in: Calendar.current.component(.year, from: now))
    }

    /// "Sunday", when the year is known. `Calendar` numbers weekdays from one
    /// and its symbols from zero, which is the off by one this line exists to
    /// get right in one place.
    private var birthWeekdayName: String? {
        guard let weekday = calendar.birthWeekday(profile.birthday) else { return nil }
        let names = Calendar.current.weekdaySymbols
        guard weekday >= 1, weekday <= names.count else { return nil }
        return names[weekday - 1]
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 22) {
                    if isBirthday { celebration } else { countdown }
                    songCard
                    if !twins.isEmpty { twinsCard }
                    leapNote
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 36)
            }
            .background(Theme.canvas)
            .navigationTitle("Mine")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: onOpenSettings) {
                        Label("Settings", systemImage: "gearshape")
                    }
                    .tint(.primary)
                }
            }
            // Two tasks rather than one, so neither request waits on the other.
            .task { await loadTwins() }
            .task { await loadSong() }
        }
        .tint(Theme.accent)
    }

    // MARK: Hero

    private var countdown: some View {
        VStack(spacing: 6) {
            Text("YOUR DAY")
                .font(.caption.weight(.heavy))
                .kerning(3)
                .foregroundStyle(Theme.accent)

            Text(String(daysAway))
                .font(.system(size: heroSize, weight: .heavy, design: .serif))
                .foregroundStyle(.primary)
                .lineLimit(1)
                .minimumScaleFactor(0.4)
                .contentTransition(.numericText())

            Text(daysAway == 1 ? "day until" : "days until")
                .font(.headline)
                .foregroundStyle(.secondary)

            Text(profile.birthday.date.displayName())
                .font(Theme.display(.title))
                .foregroundStyle(.primary)

            if let birthWeekdayName {
                Text("born on a \(birthWeekdayName)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            HStack(spacing: 8) {
                if let age = calendar.ageOnNextBirthday(profile.birthday, from: now) {
                    Text("You turn \(age)")
                }
                if let days = calendar.daysAlive(profile.birthday, on: now) {
                    if calendar.ageOnNextBirthday(profile.birthday, from: now) != nil {
                        Text("·").foregroundStyle(.tertiary)
                    }
                    Text("\(days.formatted()) days old")
                }
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 44)
        .background(Theme.bloom)
    }

    private var celebration: some View {
        VStack(spacing: 10) {
            Text("TODAY")
                .font(.caption.weight(.heavy))
                .kerning(3)
                .opacity(0.8)

            Text("Happy birthday")
                .font(Theme.display(.largeTitle))
                .multilineTextAlignment(.center)
                .minimumScaleFactor(0.6)

            Text("\(observed.displayName()) is yours.")
                .font(.headline)
                .opacity(0.9)

            if let days = calendar.daysAlive(profile.birthday, on: now) {
                Text("\(days.formatted()) days, and this is the one.")
                    .font(.subheadline)
                    .opacity(0.85)
            }
        }
        .foregroundStyle(Theme.cream)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 52)
        .padding(.horizontal, 20)
        .background(Theme.celebration, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
    }

    // MARK: Cards

    /// The one fact on this screen that somebody would read out loud to a
    /// friend, so it sits above the list of people and is set like a title
    /// rather than like a row.
    ///
    /// It needs a birth year, and it shows nothing at all when there is no
    /// chart covering that week rather than reaching for the nearest one.
    @ViewBuilder
    private var songCard: some View {
        if let song {
            VStack(alignment: .leading, spacing: 12) {
                Text("THE WEEK YOU WERE BORN")
                    .font(.caption2.weight(.heavy))
                    .kerning(2)
                    .foregroundStyle(Theme.accent)

                VStack(alignment: .leading, spacing: 4) {
                    Text(song.song)
                        .font(Theme.display(.title2, weight: .bold))
                        .foregroundStyle(.primary)
                        .fixedSize(horizontal: false, vertical: true)

                    Text(song.artist)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Text("Number one on the \(song.chart), \(song.displayDate())")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .birthedCard()
        }
    }

    private var twinsCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("You share \(profile.birthday.date.displayName()) with")
                .font(.headline)

            ForEach(twins) { person in
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    Text(person.birthYear.map { String($0) } ?? "")
                        .font(.footnote.weight(.bold).monospacedDigit())
                        .foregroundStyle(Theme.accent)
                        .frame(width: 46, alignment: .leading)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(person.name).font(.subheadline.weight(.semibold))
                        if let description = person.shortDescription, !description.isEmpty {
                            Text(description)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                    }
                    Spacer(minLength: 0)
                }
            }

            Text("Open the Today tab and browse to your date for the full list.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .birthedCard()
    }

    @ViewBuilder
    private var leapNote: some View {
        // FR-036. When the app is standing in another day for February 29 it
        // has to say so rather than quietly moving the birthday.
        if profile.birthday.isLeapDay, observed != profile.birthday.date {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: "calendar.badge.exclamationmark")
                    .foregroundStyle(Theme.accent)
                Text("There is no February 29 this year, so Birthed is using \(observed.displayName()). You can change that in Settings.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            .birthedCard()
        }
    }

    private func loadTwins() async {
        twins = (try? await repository.notablePeople(bornOn: profile.birthday.date, limit: 3)) ?? []
    }

    private func loadSong() async {
        guard let year = profile.birthday.year else { return }
        // try? on a call that already returns an optional gives a double
        // optional, and the flatten is what stops that being a warning and a
        // card that never appears.
        song = (try? await repository.numberOneSong(
            theWeekOf: profile.birthday.date,
            birthYear: year
        )) ?? nil
    }
}
