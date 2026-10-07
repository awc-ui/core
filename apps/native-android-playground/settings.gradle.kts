pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }
dependencyResolutionManagement { repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS); repositories { google(); mavenCentral() } }
rootProject.name = "AWCNativePlayground"
include(":app", ":native-ui")
project(":native-ui").projectDir = file("../../packages/native-android")
