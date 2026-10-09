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
        case "md-fab-menu-item": set(["icon": "edit", "label": "Write a note"])
        case "md-split-button": set(["icon": "check", "label": "Publish", "menuLabel": "More actions"])
        case "md-checkbox", "md-radio", "md-switch": set(["value": "updates"]); children = [text("Receive project updates")]
        case "md-chip": set(["label": "Design system", "variant": "filter", "removable": true, "icon": "star"])
        case "md-button-group", "md-segmented-button-set":
            children = ["Day", "Week", "Month"].enumerated().map { index, label in AWCNode(id: "segment-\(index)", tag: tag == "md-button-group" ? "md-button" : "md-segmented-button", properties: ["label": .string(label), "value": .string(label.lowercased()), "selected": .bool(index == 0)], children: tag == "md-button-group" ? [text(label)] : []) }
        case "md-segmented-button": set(["label": "Week", "value": "week", "icon": "calendar_month"])
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
        case "md-avatar": set(["name": "Alex Morgan", "size": "lg"])
        case "md-badge": set(["variant": "large", "value": "12"])
        case "md-status-dot": set(["state": "success", "label": "All systems operational"])
        case "md-skeleton": set(["lines": 3, "variant": "text", "width": "260px"])
        case "md-progress-indicator": set(["value": 0.65, "max": 1, "variant": "linear", "label": "Upload progress"])
        case "md-meter": set(["value": 65, "max": 100, "showLabel": true, "showValue": true, "label": "Storage used"])
        case "md-loading-indicator": set(["label": "Loading your workspace"])
        case "md-ripple": children = [text("Tap to see native feedback")]
        case "md-card": set(["variant": "outlined", "interactive": true, "fullWidth": true]); children = [text("AWC Native", slot: "headline"), text("Your component library, rendered with native controls."), AWCNode(tag: "md-button", children: [text("Explore")], slot: "actions")]
        case "md-accordion": children = ["Getting started", "Tokens and themes", "Native events"].enumerated().map { index, title in AWCNode(tag: "md-accordion-item", properties: ["headline": .string(title), "expanded": .bool(index == 0)], children: [text("This section uses SwiftUI disclosure state and accepts composed native children.")]) }; set(["exclusive": true])
        case "md-accordion-item": set(["headline": "Getting started", "supportingText": "Learn the portable component API", "expanded": true]); children = [text("Pass properties and children to AWCNativeView, then observe the emitted events.")]
        case "md-list": set(["selectionMode": "single-select"]); children = ["Design review", "Prototype", "Release"].map { AWCNode(tag: "md-list-item", properties: ["headline": .string($0), "supportingText": "Project milestone", "leadingIcon": "folder"]) }
        case "md-list-item": set(["type": "button", "headline": "Design review", "supportingText": "Today, 14:30", "leadingIcon": "calendar_month", "selectionMode": "single-select"])
        case "md-app-bar": set(["headline": "Workspace", "subtitle": "Build something useful", "leadingIcon": "menu", "variant": "large"])
        case "md-toolbar": children = ["edit", "share", "delete"].map { AWCNode(tag: "md-icon-button", properties: ["icon": .string($0), "variant": "tonal"]) }
        case "md-navigation-bar", "md-navigation-rail", "md-tabs":
            children = ["Home", "Projects", "Settings"].enumerated().map { index, title in AWCNode(tag: tag == "md-tabs" ? "md-tab" : tag == "md-navigation-rail" ? "md-navigation-rail-tab" : "md-navigation-tab", properties: ["label": .string(title), "icon": .string(["home", "folder", "settings"][index]), "value": .string(title.lowercased()), "active": .bool(index == 0)]) }
        case "md-navigation-tab", "md-navigation-rail-tab", "md-tab": set(["label": "Projects", "icon": "folder", "active": true])
        case "md-tab-panels": children = [AWCNode(tag: "md-tab-panel", properties: ["active": true], children: [text("Overview panel content")]), AWCNode(tag: "md-tab-panel", properties: ["active": false], children: [text("Hidden details panel")])]
        case "md-tab-panel": set(["active": true]); children = [text("Overview"), text("Compose arbitrary native components inside a tab panel."), AWCNode(tag: "md-button", children: [text("Continue")])]
        case "md-breadcrumbs": children = ["Home", "Projects", "AWC Native"].enumerated().map { index, title in AWCNode(tag: "md-breadcrumb-item", properties: ["current": .bool(index == 2)], children: [text(title)]) }
        case "md-breadcrumb-item": children = [text("Projects")]
        case "md-stepper": set(["active": 0, "nav": true]); children = ["Account", "Workspace", "Review"].map { AWCNode(tag: "md-step", properties: ["label": .string($0), "description": .string("Set up your \($0.lowercased())")], children: [text("Complete this section, then continue to the next step.")]) }
        case "md-step": set(["label": "Workspace", "description": "Choose a project name", "active": true]); children = [node(for: "md-text-field")]
        case "md-dialog", "md-bottom-sheet", "md-side-sheet": set(["headline": "Project details", "open": false, "closeable": true]); children = [text("This overlay is presented by the operating system."), node(for: "md-text-field")]
        case "md-menu", "md-fab-menu": set(["open": true, "listLabel": "Project actions", "menuLabel": "Create"]); children = ["Edit project", "Share with team", "Archive"].map { AWCNode(tag: tag == "md-fab-menu" ? "md-fab-menu-item" : "md-menu-item", properties: ["headline": .string($0), "label": .string($0), "icon": "edit"]) }
        case "md-menu-item": set(["headline": "Notifications", "type": "checkbox", "supportingText": "Get updates about this project"])
        case "md-sub-menu-item": set(["headline": "Share"]); children = [AWCNode(tag: "md-menu-item", properties: ["headline": "Copy link"]), AWCNode(tag: "md-menu-item", properties: ["headline": "Invite team"])]
        case "md-menu-item-group": set(["label": "Workspace"]); children = [AWCNode(tag: "md-menu-item", properties: ["headline": "Overview"]), AWCNode(tag: "md-menu-item", properties: ["headline": "Settings"])]
        case "md-snackbar": set(["message": "Project saved", "action": "Undo", "open": true, "closeable": true, "autoHide": false])
        case "md-tooltip": set(["text": "This is rendered as native SwiftUI content.", "subhead": "Component details", "variant": "rich", "open": true])
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
