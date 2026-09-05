// swift-tools-version: 5.9
import PackageDescription

// This package exists so the domain can be tested from a terminal, with
// `swift test`, without opening Xcode and without a test target in the project.
//
// It does not replace the app target. Both compile the same files: the app
// through the synchronised folder in the Xcode project, this package through
// the paths below. That is deliberate. The domain layer carries nearly all of
// the product's correctness risk, per SDS.md section 11, and it needs a
// feedback loop measured in seconds.
//
//     swift test
//
let package = Package(
    name: "BirthedDomain",
    platforms: [.iOS(.v17), .macOS(.v13)],
    targets: [
        .target(name: "BirthedDomain", path: "Birthed/Domain"),
        .testTarget(
            name: "BirthedDomainTests",
            dependencies: ["BirthedDomain"],
            path: "BirthedTests/DomainTests"
        ),
    ]
)
