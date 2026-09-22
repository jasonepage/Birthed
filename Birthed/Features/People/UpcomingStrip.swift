import SwiftUI

/// The next thirty days as a line with people on it, so the shape of the
/// month is one glance: who is close, who is bunched together, where the gap
/// is. Each person is their initial; the next one is filled.
struct UpcomingStrip: View {
    /// Soonest first, already cut to the window.
    let people: [Person]
    let now: Date
    let onOpen: (Person) -> Void

    static let window = 30
    private let calendar = BirthdayCalendar()

    private var endName: String {
        guard let end = Calendar.current.date(byAdding: .day, value: Self.window, to: now) else { return "" }
        let month = Calendar.current.component(.month, from: end)
        let day = Calendar.current.component(.day, from: end)
        let names = Calendar.current.shortMonthSymbols
        return month >= 1 && month <= names.count ? "\(names[month - 1]) \(day)" : ""
    }

    var body: some View {
        GeometryReader { proxy in
            let inset: CGFloat = 20
            let width = max(1, proxy.size.width - inset * 2)
            ZStack(alignment: .topLeading) {
                Rectangle()
                    .fill(HivePalette.cellEdge)
                    .frame(width: width, height: 2)
                    .offset(x: inset, y: 32)

                Circle()
                    .fill(Theme.emberDeep)
                    .frame(width: 12, height: 12)
                    .shadow(color: Theme.emberDeep.opacity(0.8), radius: 6)
                    .offset(x: inset - 6, y: 27)

                Text("today")
                    .font(.system(size: 10))
                    .foregroundStyle(HivePalette.cellDim)
                    .offset(x: inset - 12, y: 46)

                Text(endName)
                    .font(.system(size: 10))
                    .foregroundStyle(HivePalette.cellDim)
                    .frame(width: 60, alignment: .trailing)
                    .offset(x: proxy.size.width - inset - 60, y: 46)

                ForEach(Array(people.enumerated()), id: \.element.id) { index, person in
                    let days = calendar.daysUntil(person.birthday, from: now)
                    // Two people on one day would sit on top of each other;
                    // the second steps aside by half a dot.
                    let sameDayBefore = people.prefix(index).filter {
                        calendar.daysUntil($0.birthday, from: now) == days
                    }.count
                    let x = inset + width * CGFloat(max(days, 0)) / CGFloat(Self.window) + CGFloat(sameDayBefore) * 14
                    dot(person, isNext: index == 0)
                        .offset(x: x - 15, y: 18)
                }
            }
        }
        .frame(height: 66)
        .background(HivePalette.cell, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(HivePalette.cellEdge, lineWidth: 1)
        )
        .accessibilityElement(children: .contain)
        .accessibilityLabel("The next thirty days")
    }

    private func dot(_ person: Person, isNext: Bool) -> some View {
        Button { onOpen(person) } label: {
            Text(String(PersonDay.shortName(person.trimmedName).prefix(1)).uppercased())
                .font(.system(size: 12, weight: .heavy))
                .foregroundStyle(isNext ? HivePalette.buzzInk : HivePalette.cellMark)
                .frame(width: 30, height: 30)
                .background(isNext ? Theme.honey : HivePalette.cell, in: Circle())
                .overlay(Circle().strokeBorder(Theme.honey, lineWidth: 2))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(person.trimmedName), in \(calendar.daysUntil(person.birthday, from: now)) days")
    }
}
