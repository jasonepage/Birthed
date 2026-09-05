import SwiftUI

/// Your day: the countdown, and on the day itself, the day.
///
/// `FR-034` counts in whole local days. `FR-035` switches to a distinct state
/// on the birthday rather than showing a zero. `FR-036` says so out loud when
/// a February 29 birthday is being observed on another date.
struct MyDayView: View {
    let profile: Profile
    let repository: DayPageRepository

    @State private var twins: [NotablePerson] = []
    @ScaledMetric(relativeTo: .largeTitle) private var heroSize: CGFloat = 128

    private let calendar = BirthdayCalendar()
    private var now: Date { Date() }

    private var isBirthday: Bool { calendar.isBirthdayToday(profile.birthday, on: now) }
    private var daysAway: Int { calendar.daysUntil(profile.birthday, from: now) }
    private var observed: CalendarDate {
        calendar.observedDate(for: profile.birthday,
                              in: Calendar.current.component(.year, from: now))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 22) {
                    if isBirthday { celebration } else { countdown }
                    if !twins.isEmpty { twinsCard }
                    leapNote
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 36)
            }
            .background(Theme.canvas)
            .navigationTitle("Mine")
            .navigationBarTitleDisplayMode(.inline)
            .task { await loadTwins() }
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

            if let age = calendar.ageOnNextBirthday(profile.birthday, from: now) {
                Text("You turn \(age).")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .padding(.top, 2)
            }
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

            if let age = calendar.ageOnNextBirthday(profile.birthday, from: now) {
                Text("You are \(age).")
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
                Text("There is no February 29 this year, so Birthed is using \(observed.displayName()). You can change that in the Me tab.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            .birthedCard()
        }
    }

    private func loadTwins() async {
        twins = (try? await repository.notablePeople(bornOn: profile.birthday.date, limit: 3)) ?? []
    }
}
