import Foundation
@testable import BirthedDomain

/// Builds an instant from a wall clock date in a named time zone.
///
/// Noon rather than midnight, because on a spring forward day midnight in some
/// zones does not exist, and a test that fails for that reason is testing
/// Foundation rather than us.
func instant(_ year: Int, _ month: Int, _ day: Int, zone: TimeZone) -> Date {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = zone
    var components = DateComponents()
    components.year = year
    components.month = month
    components.day = day
    components.hour = 12
    guard let date = calendar.date(from: components) else {
        fatalError("could not build \(year)-\(month)-\(day) in \(zone.identifier)")
    }
    return date
}

func zone(_ identifier: String) -> TimeZone {
    guard let zone = TimeZone(identifier: identifier) else {
        fatalError("unknown time zone \(identifier)")
    }
    return zone
}

let losAngeles = zone("America/Los_Angeles")
let kiritimati = zone("Pacific/Kiritimati")   // coordinated universal time plus 14
let pagoPago = zone("Pacific/Pago_Pago")      // coordinated universal time minus 11

func calendarIn(_ timeZone: TimeZone) -> BirthdayCalendar {
    BirthdayCalendar(calendar: Calendar(identifier: .gregorian), timeZone: timeZone)
}

func birthday(_ month: Int, _ day: Int, year: Int? = nil,
              observance: LeapObservance = .february28) -> CalendarBirthday {
    guard let value = CalendarBirthday(month: month, day: day, year: year,
                                       leapObservance: observance) else {
        fatalError("invalid birthday \(month)/\(day)")
    }
    return value
}
