// swift-tools-version: 5.9
import PackageDescription
let package = Package(
    name: "AWCNativePlayground",
    platforms: [.macOS(.v14)],
    dependencies: [.package(path: "../../packages/native-ios")],
    targets: [.executableTarget(name: "AWCPlayground", dependencies: [.product(name: "AWCUI", package: "native-ios")], path: "AWCPlayground"), .executableTarget(name: "AWCSnapshots", dependencies: [.product(name: "AWCUI", package: "native-ios")], path: "SnapshotRenderer")]
)
