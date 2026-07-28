// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "eventkitcli",
    platforms: [.macOS(.v14)],
    dependencies: [
        .package(url: "https://github.com/apple/swift-argument-parser.git", from: "1.3.0"),
    ],
    targets: [
        .executableTarget(
            name: "eventkitcli",
            dependencies: [
                .product(name: "ArgumentParser", package: "swift-argument-parser"),
            ],
            path: "Sources",
            linkerSettings: [
                // TCC needs a usage description on the requesting binary. A bare CLI has
                // no bundle, so embed Info.plist into a __TEXT,__info_plist section.
                // Without it macOS 14+ denies EventKit access and never prompts.
                .unsafeFlags([
                    "-Xlinker", "-sectcreate",
                    "-Xlinker", "__TEXT",
                    "-Xlinker", "__info_plist",
                    "-Xlinker", "Info.plist",
                ])
            ]
        ),
    ]
)
