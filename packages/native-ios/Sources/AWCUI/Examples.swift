import Foundation

/// Interactive fixtures are separate from the renderer: production controls never substitute demo data.
public enum AWCExamples {
    public static func node(for tag: String) -> AWCNode {
        var properties = AWCComponentCatalog.defaults[tag] ?? [:]
        var children: [AWCNode] = []
        func set(_ values: [String: AWCValue]) { properties.merge(values) { _, new in new } }
        func text(_ value: String, slot: String? = nil) -> AWCNode { .text(value, slot: slot) }
        let choices: AWCValue = [["value": "design", "label": "Design", "icon": "edit"], ["value": "engineering", "label": "Engineering", "icon": "settings"], ["value": "research", "label": "Research", "icon": "search"], ["value": "archived", "label": "Archived", "disabled": true]]
        switch tag {
        case "md-button": set(["variant": "filled", "size": "md"]); children = [text("Continue")]
        case "md-icon-button": set(["icon": "favorite", "toggle": true, "selectedIcon": "favorite"])
        case "md-fab": set(["icon": "add", "label": "New project", "extended": true])
        case "md-fab-menu-item": set(["icon": "edit", "label": "New document"])
        case "md-split-button": set(["icon": "check", "label": "Publish", "menuLabel": "More actions"])
        case "md-checkbox", "md-radio", "md-switch": set(["value": "updates"]); children = [text("Receive project updates")]
        case "md-chip": set(["label": "Design system", "variant": "filter", "removable": true, "icon": "star"])
        case "md-button-group", "md-segmented-button-set":
            children = ["Day", "Week", "Month"].enumerated().map { index, label in AWCNode(id: "segment-\(index)", tag: tag == "md-button-group" ? "md-button" : "md-segmented-button", properties: ["label": .string(label), "value": .string(label.lowercased()), "selected": .bool(index == 0)], children: tag == "md-button-group" ? [text(label)] : []) }
        case "md-segmented-button": set(["label": "Day", "value": "day", "selected":true])
        case "md-text-field": set(["label": "Project name", "placeholder": "e.g. AWC Native", "supportingText": "A name your team will recognize", "clearable": "internal"])
        case "md-number-field": set(["label": "Team members", "value": 5, "min": 1, "max": 30, "step": 1])
        case "md-otp-field": set(["label": "Verification code", "length": 6, "supportingText": "Enter the six-digit code", "value": "12"])
        case "md-select", "md-multi-select", "md-autocomplete": set(["label": "Team", "placeholder": "Choose your team", "options": choices, "filterable": true, "clearable": true, "showSelectAll": true, "value": tag == "md-multi-select" ? ["design"] : "design"])
        case "md-select-option": set(["label": "Design", "value": "design", "icon": "edit", "supportingText": "Visual design and research"])
        case "md-slider": set(["value": 40, "min": 0, "max": 100, "sliderAriaLabel": "Volume", "labeled": true])
        case "md-rating": set(["value": 3.5, "precision": 0.5, "showValueLabel": true])
        case "md-date-picker": set(["label": "Start date", "value": "2026-10-07"])
        case "md-time-picker": set(["label": "Meeting time", "value": "14:30"])
        case "md-color-picker": set(["value": "#6750A4", "showHex": true, "presets": ["#6750A4", "#386A20", "#006A6A", "#BA1A1A"]])
        case "md-avatar": set(["name": "Alex Morgan", "size": "large"])
        case "md-badge": set(["variant": "large", "value": "12"])
        case "md-status-dot": set(["state": "online", "label": "All systems operational"])
        case "md-skeleton": set(["lines": 3, "variant": "text", "animation": "wave", "fullWidth": true])
        case "md-progress-indicator": set(["value":64,"wave":true,"label":"Building native components"])
        case "md-meter": set(["value": 72, "max": 100, "showLabel": true, "showValue": true, "label": "Storage used"])
        case "md-loading-indicator": set(["label": "Loading your workspace"])
        case "md-ripple": children = [text("Tap to see native feedback")]
        // Laboratory recipe content: the card itself keeps its source defaults.
        case "md-card": children = [text("✧"), text("Ideas take shape."), text("A shared design language, built for every surface."), AWCNode(tag: "md-button", properties: ["variant": "text"], children: [text("Explore workspace")])]
        case "md-accordion": children = [("A shared design language", "Built for every surface", "Colors, spacing, shapes, and component contracts come from the same AWC source.", true), ("Native by design", "Platform-specific implementations", "Native views retain each platform's own controls and behavior.", false)].enumerated().map { index, item in AWCNode(id: "accordion-item-\(index)", tag: "md-accordion-item", properties: ["headline": .string(item.0), "supportingText": .string(item.1), "expanded": .bool(item.3)], children: [text(item.2)]) }
        case "md-accordion-item": set(["headline": "A shared design language", "supportingText": "Built for every surface", "expanded": true]); children = [text("Colors, spacing, shapes, and component contracts come from the same AWC source.")]
        case "md-list": set(["selectionMode": "single-select"]); children = ["Design review", "Prototype", "Release"].map { AWCNode(tag: "md-list-item", properties: ["headline": .string($0), "supportingText": "Project milestone", "leadingIcon": "folder"]) }
        case "md-list-item": set(["type": "button", "headline": "Design review", "supportingText": "Today, 14:30", "leadingIcon": "calendar_month", "selectionMode": "single-select"])
        case "md-app-bar": set(["headline": "Your workspace", "leadingIcon": "menu", "leadingIconLabel": "Open navigation"])
            children = [AWCNode(tag: "md-icon-button", properties: ["icon": "search", "aria-label": "Search"], slot: "trailing")]
        case "md-toolbar": set(["variant": "floating", "ariaLabelProp": "Formatting"])
            children = [("undo", "Undo", false), ("redo", "Redo", false), ("", "", false), ("format_bold", "Bold", true), ("format_italic", "Italic", true)].map { icon, label, toggle in
                icon.isEmpty ? AWCNode(tag: "md-divider", properties: ["vertical": true])
                    : AWCNode(tag: "md-icon-button", properties: ["icon": .string(icon), "aria-label": .string(label)].merging(toggle ? ["toggle": true] : [:]) { a, _ in a }) }
        case "md-tabs": set(["ariaLabelProp": "Workspace sections"]); children = ["Overview", "Activity", "Settings"].map { AWCNode(tag: "md-tab", properties: ["label": .string($0)]) }
        case "md-navigation-bar": children = [("Home", "home"), ("Explore", "explore"), ("Saved", "bookmark")].map { AWCNode(tag: "md-navigation-tab", properties: ["label": .string($0.0), "icon": .string($0.1)]) }
        case "md-navigation-rail":
            children = ["Home", "Saved", "Settings"].enumerated().map { index, title in AWCNode(tag: tag == "md-navigation-rail" ? "md-navigation-rail-tab" : "md-navigation-tab", properties: ["label": .string(title), "icon": .string(["home", "favorite", "settings"][index])].merging(index == 0 ? ["active": true] : [:]) { a, _ in a }) }
        case "md-navigation-tab": set(["label": "Home", "icon": "home", "active": true])
        case "md-navigation-rail-tab": set(["label": "Home", "icon": "home", "active": true])
        case "md-tab": set(["label": "Overview", "active": true])
        case "md-tab-panels": children = ["Your workspace, across every platform.", "Recent activity will appear here.", "Make this workspace your own."].enumerated().map { index, copy in AWCNode(tag: "md-tab-panel", properties: ["active": .bool(index == 0)], children: [text(copy)]) }
        case "md-tab-panel": set(["active": true]); children = [text("Your workspace, across every platform.")]
        case "md-breadcrumbs": children = [("Home", "#home", "home"), ("Projects", "#projects", ""), ("AWC Native", "", "")].map { title, href, icon in
            AWCNode(tag: "md-breadcrumb-item", properties: (href.isEmpty ? [:] : ["href": .string(href)]).merging(icon.isEmpty ? [:] : ["icon": .string(icon)]) { a, _ in a }, children: [text(title)]) }
        case "md-breadcrumb-item": set(["href": "#projects"]); children = [text("Projects")]
        case "md-stepper": set(["active": 0, "nav": true]); children = ["Account", "Workspace", "Review"].map { AWCNode(tag: "md-step", properties: ["label": .string($0), "description": .string("Set up your \($0.lowercased())")], children: [text("Complete this section, then continue to the next step.")]) }
        case "md-step": set(["label": "Workspace", "description": "Choose a project name", "active": true]); children = [node(for: "md-text-field")]
        case "md-dialog", "md-bottom-sheet", "md-side-sheet": set(["headline": "Project details", "open": false, "closeable": true]); children = [text("This overlay is presented by the operating system."), node(for: "md-text-field")]
        case "md-menu": return AWCPreviewMenu.menu(for: AWCNode(id: "demo-menu", tag: "md-menu", properties: properties))
        case "md-fab-menu":
            set(["open":false,"anchor":"demo-fab-anchor","placement":"down"])
            children=zip(["edit","folder","photo"],["New document","New folder","Upload image"]).enumerated().map {index,pair in
                AWCNode(id:"demo-fab-item-\(index)",tag:"md-fab-menu-item",properties:["icon":.string(pair.0),"label":.string(pair.1)])
            }
        case "md-menu-item": set(["headline": "New project", "supportingText": "Start something new"])
        case "md-sub-menu-item": set(["headline": "Export"]); children = [AWCNode(tag: "md-menu", children: [AWCNode(tag: "md-menu-item", properties: ["headline": "SwiftUI"]), AWCNode(tag: "md-menu-item", properties: ["headline": "Compose"])], slot: "submenu")]
        case "md-menu-item-group": set(["label": "Workspace"]); children = [AWCNode(tag: "md-menu-item", properties: ["headline": "New project", "supportingText": "Start something new"]), AWCNode(tag: "md-menu-item", properties: ["headline": "Duplicate", "trailingText": "⌘D"])]
        case "md-snackbar": set(["message": "Project saved", "action": "Undo", "open": true, "closeable": true, "autoHide": false])
        case "md-tooltip": set(["text": "One source. Every surface."]); children=[AWCNode(id:"demo-tooltip-anchor",tag:"md-button",properties:["variant":"tonal"],children:[text("Hover or focus me")])]
        case "md-search": set(["placeholder": "Search your workspace", "open": true]); children = [AWCNode(tag: "md-list-item", properties: ["headline": "AWC Native", "supportingText": "Recently opened", "leadingIcon": "folder"])]
        case "md-table", "md-table-container", "md-table-head", "md-table-body", "md-table-foot", "md-table-row", "md-table-cell", "md-table-toolbar", "md-table-sort-label", "md-table-pagination", "md-table-expand-toggle": return tableExample(tag)
        case "md-transfer-list": set(["items": choices, "value": ["design"], "searchable": true])
        case "md-organization-chart": set(["selectionMode": "multiple", "nodes": [["id": "lead", "name": "Alex Morgan", "title": "Product lead", "children": [["id": "design", "name": "Sam Lee", "title": "Design"], ["id": "engineering", "name": "Robin Chen", "title": "Engineering"]]]]])
        case "md-line-chart", "md-area-chart", "md-bar-chart": set(["label": "Weekly activity", "subtitle": "Native Canvas • tap to inspect", "showMarks": true, "series": [["id": "design", "name": "Design", "data": [12, 19, 15, 26, 22, 31, 28]], ["id": "engineering", "name": "Engineering", "data": [8, 12, 18, 14, 24, 21, 30]]]])
        case "md-pie-chart": set(["label": "Team distribution", "innerRadius": "45%", "showLabels": true, "data": [["name": "Design", "value": 35], ["name": "Engineering", "value": 45], ["name": "Research", "value": 20]]])
        case "md-sparkline": set(["data": [4, 7, 5, 12, 9, 15, 13, 20], "variant": "area"])
        default: break
        }
        return AWCNode(id: "example-" + tag, tag: tag, properties: properties, children: children)
    }
    public static func tableExample(_ tag: String) -> AWCNode {
        func cell(_ text: String, head: Bool = false) -> AWCNode { AWCNode(tag: "md-table-cell", properties: ["head": .bool(head)], children: [.text(text)]) }
        let header = AWCNode(tag: "md-table-head", children: [AWCNode(tag: "md-table-row", children: [AWCNode(tag: "md-table-cell", properties: ["head": true], children: [AWCNode(tag: "md-table-sort-label", properties: ["column": "name"], children: [.text("Project")])]), cell("Status", head: true), cell("Members", head: true)])])
        let rows = [["AWC Native", "In progress", "8"], ["Design tokens", "Complete", "4"], ["Playground", "Review", "6"]].enumerated().map { index, values in AWCNode(tag: "md-table-row", properties: ["value": .string("project-\(index)"), "selectable": true, "clickable": true, "expandable": index == 0 ? true : false], children: values.map { cell($0) } + [AWCNode.text("Last updated today", slot: "expanded")]) }
        let body = AWCNode(tag: "md-table-body", children: rows)
        switch tag {
        case "md-table-container": return AWCNode(id: "example-" + tag, tag: tag, children: [tableExample("md-table")])
        case "md-table-head": return header
        case "md-table-body": return body
        case "md-table-foot": return AWCNode(tag: tag, children: [AWCNode(tag: "md-table-row", children: [cell("Total"), cell("3 projects"), cell("18")])])
        case "md-table-row": return rows[0]
        case "md-table-cell": return cell("AWC Native")
        case "md-table-toolbar": return AWCNode(tag: tag, properties: ["headline": "Projects", "supportingText": "All your team's work"], children: [AWCNode(tag: "md-icon-button", properties: ["icon": "filter_list"])])
        case "md-table-pagination": return AWCNode(tag: tag, properties: ["count": 87, "page": 0, "rowsPerPage": 10, "showFirstLast": true])
        case "md-table-sort-label": return AWCNode(tag: tag, properties: ["column": "name"], children: [.text("Project")])
        case "md-table-expand-toggle": return AWCNode(tag: tag, properties: ["buttonLabel": "Expand project"])
        default: return AWCNode(id: "example-" + tag, tag: "md-table", properties: ["caption": "Workspace projects", "selection": "multiple", "label": "Project table"], children: [header, body])
        }
    }
}
