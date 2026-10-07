import SwiftUI

extension AWCNativeView {
    @ViewBuilder var table: some View {
        switch node.tag {
        case "md-table-container":
            ScrollView([.horizontal, .vertical]) { content().padding(12) }.frame(maxHeight: numericDimension(s("maxHeight")) ?? 420).background(surface, in: RoundedRectangle(cornerRadius: 16))
        case "md-table":
            VStack(alignment: .leading, spacing: 0) {
                if !s("caption").isEmpty { Text(s("caption")).font(.headline).padding(12) }
                if b("loading") { ProgressView().padding() }
                if b("empty") { content("empty"); if !node.children.contains(where: { $0.slot == "empty" }) { Text("No rows").foregroundStyle(.secondary).padding() } }
                else {
                    ForEach(node.children.filter { $0.slot == nil }) { item in
                        child(preparedTableSection(item)) { event in
                            onEvent(event)
                            if event.name == "mdSortRequest" {
                                let column = event.detail["column"].string
                                let order = s("sortBy") == column && s("sortOrder") == "asc" ? "desc" : "asc"
                                set("sortBy", .string(column)); set("sortOrder", .string(order)); emit("mdSortChange", ["column": .string(column), "order": .string(order)])
                            }
                            if event.name == "mdRowSelectionChange" {
                                let value = event.detail["value"].string; var selection = tableSelection
                                if value == "__awc_native_select_all__" {
                                    selection = event.detail["selected"].bool == true ? Set(selectableTableRows.map { $0.properties["value"]?.string.isEmpty == false ? $0.properties["value"]!.string : $0.id }) : []
                                } else if event.detail["selected"].bool == true { if s("selection") == "single" { selection.removeAll() }; selection.insert(value) } else { selection.remove(value) }
                                set("_tableSelection", .array(selection.sorted().map(AWCValue.string)))
                                let total = selectableTableRows.count
                                emit("mdSelectionChange", ["count": .number(Double(selection.count)), "total": .number(Double(total)), "values": .array(selection.sorted().map(AWCValue.string)), "all": .bool(total > 0 && selection.count == total), "indeterminate": .bool(!selection.isEmpty && selection.count < total)])
                            }
                        }
                    }
                }
            }.accessibilityLabel(label).overlay(Rectangle().stroke(theme.primary.opacity(0.12)))
        case "md-table-head", "md-table-body", "md-table-foot":
            VStack(spacing: 0) { ForEach(node.children) { child($0) } }.background(node.tag == "md-table-head" ? surface : .clear)
        case "md-table-row":
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 0) {
                    if b("selectable") { Button { set("selected", .bool(!b("selected"))); emit("mdRowSelectionChange", ["selected": .bool(b("selected")), "value": p("value")]) } label: { Image(systemName: b("selected") ? "checkmark.square.fill" : "square").padding(12) }.buttonStyle(.plain).accessibilityLabel("Select row") }
                    ForEach(node.children.filter { $0.slot != "expanded" }) { child($0) { event in onEvent(event); if event.name == "awcExpand" { set("expanded", .bool(!b("expanded"))); emit("mdRowExpandedChange", ["expanded": .bool(b("expanded"))]) } } }
                    if b("expandable") { Button { set("expanded", .bool(!b("expanded"))); emit("mdRowExpandedChange", ["expanded": .bool(b("expanded"))]) } label: { Image(systemName: b("expanded") ? "chevron.up" : "chevron.down").padding(12) }.buttonStyle(.plain).accessibilityLabel("Expand row") }
                }.background(b("selected") ? theme.primary.opacity(0.15) : b("highlight") ? surface : .clear)
                .onTapGesture { if b("clickable") { emit("mdRowClick", ["value": p("value"), "row": .string(node.id)]) } }
                if b("expanded") { content("expanded").padding(12) }
                Divider()
            }
        case "md-table-cell":
            content().font(s("variant") == "meta" ? .caption : .body).fontWeight(b("head") ? .semibold : .regular)
                .frame(minWidth: 96, maxWidth: .infinity, alignment: s("align") == "end" || b("numeric") ? .trailing : s("align") == "center" ? .center : .leading)
                .padding(s("padding") == "none" ? 0 : 12).lineLimit(b("ellipsis") ? 1 : nil)
        case "md-table-toolbar":
            HStack { VStack(alignment: .leading) { Text(n("numSelected") > 0 ? "\(Int(n("numSelected"))) \(s("labelSelected", "selected"))" : label).font(.headline); support }; Spacer(); content() }.padding(16).background(surface)
        case "md-table-sort-label":
            Button { let order = s("order") == "asc" ? "desc" : "asc"; set("active", true); set("order", .string(order)); emit("mdSortRequest", ["column": p("column"), "defaultOrder": .string(s("defaultOrder", "asc"))]) } label: {
                HStack { content(); if !label.isEmpty && node.children.isEmpty { Text(label) }; Image(systemName: s("order") == "desc" ? "arrow.down" : "arrow.up").opacity(b("active") ? 1 : 0.35) }
            }.buttonStyle(.plain)
        case "md-table-pagination": pagination
        case "md-table-expand-toggle":
            Button { set("_expanded", .bool(!b("_expanded"))); emit("awcExpand", ["expanded": .bool(b("_expanded"))]) } label: { symbol(s("icon", "expand_more")).rotationEffect(.degrees(b("_expanded") ? 180 : 0)) }.buttonStyle(.plain).accessibilityLabel(s("buttonLabel", "Expand row"))
        default: EmptyView()
        }
    }
    var selectableTableRows: [AWCNode] { node.children.filter { $0.tag == "md-table-body" }.flatMap(\.children).filter { $0.properties["disabled"]?.bool != true && $0.properties["selectable"]?.bool != false } }
    var tableSelection: Set<String> {
        if local["_tableSelection"] != nil { return Set(a("_tableSelection").map(\.string)) }
        return Set(selectableTableRows.filter { $0.properties["selected"]?.bool == true }.map { $0.properties["value"]?.string.isEmpty == false ? $0.properties["value"]!.string : $0.id })
    }
    func preparedTableSection(_ section: AWCNode) -> AWCNode {
        var output = section
        if output.tag == "md-table-head" || output.tag == "md-table-foot" {
            output.children = output.children.map { item in
                var row = item
                row.properties["rowgroup"] = .string(output.tag == "md-table-head" ? "head" : "foot")
                row.properties["selectable"] = .bool(s("selection") == "multiple" && output.tag == "md-table-head")
                row.properties["value"] = "__awc_native_select_all__"
                row.properties["selected"] = .bool(!selectableTableRows.isEmpty && tableSelection.count == selectableTableRows.count)
                return row
            }
        }
        if output.tag == "md-table-body" {
            output.children = output.children.map { item in
                var row = item
                let value = item.properties["value"]?.string.isEmpty == false ? item.properties["value"]!.string : item.id
                row.properties["value"] = .string(value)
                row.properties["selectable"] = .bool(s("selection", "none") != "none" && item.properties["selectable"]?.bool != false)
                row.properties["selected"] = .bool(tableSelection.contains(value))
                return row
            }
            if !s("sortBy").isEmpty {
                let headers = node.children.first(where: { $0.tag == "md-table-head" })?.children.first?.children ?? []
                let position = headers.firstIndex { cell in cell.children.contains { $0.properties["column"]?.string == s("sortBy") } }
                if let index = position {
                    output.children.sort { lhs, rhs in
                        let a = lhs.children.indices.contains(index) ? tableCellText(lhs.children[index]) : ""
                        let b = rhs.children.indices.contains(index) ? tableCellText(rhs.children[index]) : ""
                        let ascending = (Double(a) != nil && Double(b) != nil) ? Double(a)! < Double(b)! : a.localizedStandardCompare(b) == .orderedAscending
                        return s("sortOrder") == "desc" ? (!ascending && a != b) : ascending
                    }
                }
            }
        }
        return output
    }
    func tableCellText(_ item: AWCNode) -> String {
        item.properties["text"]?.string ?? item.children.map { tableCellText($0) }.joined(separator: " ")
    }
    var pagination: some View {
        let perPage = max(1, Int(n("rowsPerPage", 10)))
        let count = max(0, Int(n("count")))
        let page = max(0, Int(n("page")))
        let lastPage = max(0, (count - 1) / perPage)
        return HStack(spacing: 8) {
            if !b("compact") {
                Text(s("labelRowsPerPage", "Rows:")).font(.caption)
                Picker("Rows per page", selection: Binding(get: { perPage }, set: { value in set("rowsPerPage", .number(Double(value))); set("page", 0); emit("mdRowsPerPageChange", ["rowsPerPage": .number(Double(value))]) })) {
                    ForEach(paginationOptions, id: \.self) { value in Text(String(value)).tag(value) }
                }.labelsHidden().frame(width: 76)
            }
            Spacer(minLength: 0)
            Text(count == 0 ? "0 of 0" : "\(min(count, page * perPage + 1))–\(min(count, (page + 1) * perPage)) of \(count)").font(.caption.monospacedDigit())
            if b("showFirstLast") { pageButton("backward.end", page: 0, disabled: page == 0, label: s("labelFirstPage", "First page")) }
            pageButton("chevron.left", page: page - 1, disabled: page == 0, label: s("labelPreviousPage", "Previous page"))
            pageButton("chevron.right", page: page + 1, disabled: page >= lastPage, label: s("labelNextPage", "Next page"))
            if b("showFirstLast") { pageButton("forward.end", page: lastPage, disabled: page >= lastPage, label: s("labelLastPage", "Last page")) }
        }.padding(10)
    }
    var paginationOptions: [Int] {
        let json = p("rowsPerPageOptions").array.compactMap { $0.number.map(Int.init) }.filter { $0 > 0 }
        let csv = s("rowsPerPageOptions").split(separator: ",").compactMap { Int($0.trimmingCharacters(in: .whitespaces)) }.filter { $0 > 0 }
        return !json.isEmpty ? json : !csv.isEmpty ? csv : [10, 25, 50]
    }
    func pageButton(_ icon: String, page: Int, disabled: Bool, label: String) -> some View {
        Button { set("page", .number(Double(page))); emit("mdPageChange", ["page": .number(Double(page))]) } label: { Image(systemName: icon).frame(width: 32, height: 32) }.buttonStyle(.plain).disabled(disabled).accessibilityLabel(label)
    }
    var transferItems: [AWCOption] { a("items").enumerated().map { index, item in AWCOption(id: item["value"].string.isEmpty ? String(index) : item["value"].string, label: item["label"].string, disabled: item["disabled"].bool ?? false, icon: item["icon"].string, supportingText: item["supportingText"].string) } }
    var transferList: some View {
        VStack(spacing: 12) {
            HStack(alignment: .top, spacing: 12) { transferColumn(false); transferColumn(true) }
            HStack {
                if !b("singleStepOnly") { Button { moveTransfer(right: true, all: true) } label: { Image(systemName: "chevron.right.2") }.accessibilityLabel(s("moveAllRightLabel", "Move all right")) }
                Button { moveTransfer(right: true, all: false) } label: { Image(systemName: "chevron.right") }.accessibilityLabel(s("moveRightLabel", "Move selected right"))
                Button { moveTransfer(right: false, all: false) } label: { Image(systemName: "chevron.left") }.accessibilityLabel(s("moveLeftLabel", "Move selected left"))
                if !b("singleStepOnly") { Button { moveTransfer(right: false, all: true) } label: { Image(systemName: "chevron.left.2") }.accessibilityLabel(s("moveAllLeftLabel", "Move all left")) }
            }.buttonStyle(AWCActionStyle(theme: theme))
        }
    }
    func transferColumn(_ target: Bool) -> some View {
        let values = Set(a("value").map(\.string))
        let sideQuery = target ? auxiliaryQuery : query
        let items = transferItems.filter { values.contains($0.id) == target && (sideQuery.isEmpty || $0.label.localizedCaseInsensitiveContains(sideQuery)) }
        return VStack(alignment: .leading, spacing: 8) {
            Text(s(target ? "targetTitle" : "sourceTitle", target ? "Chosen" : "Choices")).font(.headline)
            if b("searchable", true) { TextField(s(target ? "targetSearchPlaceholder" : "sourceSearchPlaceholder", "Search"), text: target ? $auxiliaryQuery : $query).textFieldStyle(.roundedBorder) }
            if b("showSelectAll", true) { Button("Select all (\(items.count))") { for item in items where !item.disabled { selectedIDs.insert(item.id) } }.font(.caption) }
            if items.isEmpty { Text(s("emptyText", "No items")).foregroundStyle(.secondary).padding(.vertical) }
            ForEach(items) { item in
                Button { if selectedIDs.contains(item.id) { selectedIDs.remove(item.id) } else { selectedIDs.insert(item.id) } } label: {
                    HStack { Image(systemName: selectedIDs.contains(item.id) ? "checkmark.square.fill" : "square"); Text(item.label).foregroundStyle(.primary); Spacer() }.padding(.vertical, 6)
                }.buttonStyle(.plain).disabled(item.disabled)
            }
        }.padding(12).frame(maxWidth: .infinity, minHeight: 150, alignment: .topLeading).background(surface, in: RoundedRectangle(cornerRadius: 12))
    }
    func moveTransfer(right: Bool, all: Bool) {
        var values = Set(a("value").map(\.string))
        let moved = transferItems.filter { !$0.disabled && values.contains($0.id) != right && (all || selectedIDs.contains($0.id)) }.map(\.id)
        if right { values.formUnion(moved) } else { values.subtract(moved) }
        selectedIDs.subtract(moved); set("value", .array(values.sorted().map(AWCValue.string)))
        emit("mdChange", p("value")); emit("mdMove", ["direction": .string(right ? "right" : "left"), "moved": .array(moved.map(AWCValue.string)), "target": p("value")])
    }
    var organizationChart: some View {
        ScrollView([.horizontal, .vertical]) {
            VStack(alignment: .leading, spacing: 12) {
                if a("nodes").isEmpty { content("empty") }
                ForEach(Array(a("nodes").enumerated()), id: \.offset) { _, item in orgNode(item, depth: 0) }
            }.padding(12)
        }.frame(minHeight: 160, maxHeight: 480).accessibilityLabel(s("label", "Organization chart"))
    }
    func orgNode(_ item: AWCValue, depth: Int) -> AnyView {
        let id = item["id"].string
        let expanded = local["_org_" + id]?.bool ?? item["expanded"].bool ?? true
        let selected = a("selectedIds").map(\.string).contains(id)
        return AnyView(VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                if depth > 0 { Rectangle().fill(theme.primary.opacity(0.2)).frame(width: 20, height: 1) }
                Button {
                    guard s("selectionMode", "none") != "none" && item["selectable"].bool != false else { return }
                    var ids = Set(a("selectedIds").map(\.string))
                    if s("selectionMode") == "single" { ids = [id] } else if ids.contains(id) { ids.remove(id) } else { ids.insert(id) }
                    set("selectedIds", .array(ids.sorted().map(AWCValue.string))); emit("mdSelectionChange", ["node": item, "selectedIds": p("selectedIds")])
                } label: {
                    HStack {
                        child(AWCNode(id: id + "-avatar", tag: "md-avatar", properties: ["src": item["avatar"], "name": item["name"], "initials": item["avatarInitials"]]))
                        VStack(alignment: .leading) { Text(item["name"].string).fontWeight(.semibold); Text(item["title"].string).font(.caption).foregroundStyle(.secondary) }
                    }.padding(12).background(selected ? theme.primary.opacity(0.22) : surface, in: RoundedRectangle(cornerRadius: 12))
                }.buttonStyle(.plain)
                if b("collapsible", true) && !item["children"].array.isEmpty { Button { set("_org_" + id, .bool(!expanded)); emit("mdNodeToggle", ["node": item, "expanded": .bool(!expanded)]) } label: { Image(systemName: expanded ? "chevron.down" : "chevron.right") }.accessibilityLabel(s(expanded ? "collapseLabel" : "expandLabel", expanded ? "Collapse" : "Expand")) }
            }
            if expanded { ForEach(Array(item["children"].array.enumerated()), id: \.offset) { _, child in orgNode(child, depth: depth + 1).padding(.leading, 24) } }
        })
    }
}
