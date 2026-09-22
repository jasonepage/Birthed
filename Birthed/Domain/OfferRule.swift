import Foundation

/// One condition attached to one offer.
///
/// Modelled as an enum rather than a bag of strings so the qualification
/// engine cannot be handed a rule it does not understand and quietly ignore
/// it. The data layer maps the database's `rule_type` and `params` into this
/// at the boundary; anything it cannot map arrives as `.informational`, which
/// is displayed and never affects status.
///
/// The categories come from `docs/research/reward-terms.md` section B, which is
/// 30 rule shapes taken from real brand terms rather than from imagination.
enum OfferRule: Equatable {
    // Requirements. Five, and only five, are things a person has to do.
    case accountRequired
    case appRequired
    case marketingConsentRequired
    case birthdateOnFileRequired
    case priorPurchaseRequired(lookbackMonths: Int?, category: String?, recursAnnually: Bool)

    // Deadline modifiers. Not things a person does, but dates by which a
    // requirement must already be satisfied.
    case advanceSignupFixedDays(days: Int)
    case advanceSignupRelativePeriod(before: RelativePeriod)

    // Everything else is displayed and never changes a status.
    case redemptionWindow(anchor: RedemptionAnchor, days: Int?)
    case rewardIsPoints(amount: Int, unit: String, expiryDays: Int?)
    case minimumSpend(channel: Channel, cents: Int)
    case informational(kind: InformationalRule, detail: String?)

    var requirementKey: RequirementKey? {
        switch self {
        case .accountRequired: return .account
        case .appRequired: return .app
        case .marketingConsentRequired: return .marketingConsent
        case .birthdateOnFileRequired: return .birthdateOnFile
        case .priorPurchaseRequired: return .priorPurchase
        default: return nil
        }
    }

    var isDeadlineModifier: Bool {
        switch self {
        case .advanceSignupFixedDays, .advanceSignupRelativePeriod: return true
        default: return false
        }
    }
}

/// The five things a person can be asked to do, each of which maps to one
/// `requirement_key` in the database. `docs/specs/SDS.md` section 7.
enum RequirementKey: String, CaseIterable, Equatable {
    case account
    case app
    case marketingConsent = "marketing_consent"
    case birthdateOnFile = "birthdate_on_file"
    case priorPurchase = "prior_purchase"

    /// Enrollment requirements inherit the offer's signup deadline. A prior
    /// purchase carries its own.
    var isEnrollment: Bool { self != .priorPurchase }
}

enum RequirementState: String, Equatable {
    case notStarted = "not_started"
    case done
    case notApplicable = "not_applicable"

    /// `FR-060`. Both count as satisfied. Only `notStarted` is outstanding.
    var isSatisfied: Bool { self != .notStarted }
}

/// `FR-043`. Four anchors, and no others. Dutch Bros needs `collectionDate`
/// and nothing else in the model can express it.
enum RedemptionAnchor: String, Equatable {
    case birthdayDate = "birthday_date"
    case birthdayMonth = "birthday_month"
    case monthStart = "month_start"
    case collectionDate = "collection_date"
}

/// The relative form of an advance signup deadline. Ulta requires the birth
/// date on file before the birthday month begins.
enum RelativePeriod: String, Equatable {
    case birthdayMonth = "birthday_month"
    case birthday = "birthday"
}

/// `FR-044`. Minimum spend and location validity are per channel, because
/// Sephora is $25 online and $0 in store.
enum Channel: String, Equatable {
    case inStore = "in_store"
    case brandWeb = "brand_web"
    case brandApp = "brand_app"
    case marketplace = "third_party_marketplace"
}

/// Everything the engine displays and never acts on.
enum InformationalRule: String, Equatable {
    case tierDependentWindow = "tier_dependent_window"
    case tierDependentReward = "tier_dependent_reward"
    case basketComposition = "basket_composition"
    case channelExclusion = "channel_exclusion"
    case geographicExclusion = "geographic_exclusion"
    case participatingLocationsOnly = "participating_locations_only"
    case dineInOnly = "dine_in_only"
    case ageEligibility = "age_eligibility"
    case itemCategoryExclusion = "item_category_exclusion"
    case inventoryContingent = "inventory_contingent"
    case singleUse = "single_use"
    case nonTransferable = "non_transferable"
    case noResale = "no_resale"
    case noCashValue = "no_cash_value"
    case noCombining = "no_combining"
    case redemptionMethod = "redemption_method"
    case familyEnrollment = "family_enrollment"
    case sunset
}
