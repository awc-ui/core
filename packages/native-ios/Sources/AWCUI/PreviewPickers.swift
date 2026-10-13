import SwiftUI

/// Preview-only controls avoid the separate AppKit picker panels that a hosting
/// view cannot capture. They write through the same bindings as production pickers.
struct AWCPreviewTemporalPicker: View {
    @Binding var selection: Date
    let bounds: ClosedRange<Date>
    let timeOnly: Bool
    @State private var month: Date
    private let calendar = Calendar.current

    init(selection: Binding<Date>, bounds: ClosedRange<Date>, timeOnly: Bool) {
        _selection = selection; self.bounds = bounds; self.timeOnly = timeOnly
        _month = State(initialValue: Calendar.current.dateInterval(of: .month, for: selection.wrappedValue)?.start ?? selection.wrappedValue)
    }

    var body: some View {
        if timeOnly {
            VStack(alignment: .leading, spacing: 20) {
                Text(selection, format: .dateTime.hour().minute()).font(.largeTitle.monospacedDigit())
                Stepper("Hour: \(calendar.component(.hour, from: selection))", value: timePart(.hour), in: 0...23)
                    .accessibilityIdentifier("awc-preview-hour")
                Stepper("Minute: \(calendar.component(.minute, from: selection))", value: timePart(.minute), in: 0...59)
                    .accessibilityIdentifier("awc-preview-minute")
            }
        } else {
            VStack(spacing: 12) {
                HStack {
                    Button { moveMonth(-1) } label: { Image(systemName: "chevron.left") }.accessibilityLabel("Previous month")
                    Spacer()
                    Text(month, format: .dateTime.month(.wide).year()).font(.headline)
                    Spacer()
                    Button { moveMonth(1) } label: { Image(systemName: "chevron.right") }.accessibilityLabel("Next month")
                }
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 7), spacing: 6) {
                    ForEach(0..<7) { offset in
                        Text(calendar.veryShortStandaloneWeekdaySymbols[(calendar.firstWeekday - 1 + offset) % 7])
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    ForEach(0..<42) { offset in
                        if let day = day(at: offset) {
                            let selected = calendar.isDate(day, inSameDayAs: selection)
                            Button { selection = min(max(day, bounds.lowerBound), bounds.upperBound) } label: {
                                Text("\(calendar.component(.day, from: day))").frame(maxWidth: .infinity, minHeight: 32)
                                    .background(selected ? Color.accentColor.opacity(0.22) : .clear, in: Circle())
                            }
                            .buttonStyle(.plain)
                            .disabled(day < calendar.startOfDay(for: bounds.lowerBound) || day > bounds.upperBound)
                            .accessibilityLabel(day.formatted(date: .complete, time: .omitted))
                            .accessibilityIdentifier("awc-preview-day-\(calendar.component(.day, from: day))")
                        } else { Color.clear.frame(height: 32).accessibilityHidden(true) }
                    }
                }
            }
        }
    }

    private func timePart(_ component: Calendar.Component) -> Binding<Int> {
        Binding(get: { calendar.component(component, from: selection) }, set: { value in
            var parts = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: selection)
            if component == .hour { parts.hour = value } else { parts.minute = value }
            if let date = calendar.date(from: parts) { selection = min(max(date, bounds.lowerBound), bounds.upperBound) }
        })
    }
    private func moveMonth(_ offset: Int) {
        if let next = calendar.date(byAdding: .month, value: offset, to: month) { month = next }
    }
    private func day(at offset: Int) -> Date? {
        let leading = (calendar.component(.weekday, from: month) - calendar.firstWeekday + 7) % 7
        guard let range = calendar.range(of: .day, in: .month, for: month), range.contains(offset - leading + 1) else { return nil }
        return calendar.date(byAdding: .day, value: offset - leading, to: month)
    }
}

struct AWCPreviewColorPicker: View {
    @Binding var selection: Color
    let label: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(label)
                Spacer()
                RoundedRectangle(cornerRadius: 8).fill(selection).frame(width: 48, height: 32)
            }
            channel("Red", index: 0)
            channel("Green", index: 1)
            channel("Blue", index: 2)
        }
    }
    private func channel(_ name: String, index: Int) -> some View {
        HStack {
            Text(name).frame(width: 48, alignment: .leading)
            Slider(value: Binding(get: { channels[index] }, set: { value in
                var values = channels; values[index] = value.rounded()
                selection = Color(red: values[0] / 255, green: values[1] / 255, blue: values[2] / 255)
            }), in: 0...255)
            .accessibilityLabel(name)
            .accessibilityIdentifier("awc-preview-color-\(name.lowercased())")
            Text("\(Int(channels[index]))").monospacedDigit().frame(width: 32, alignment: .trailing)
        }
    }
    private var channels: [Double] {
        let color = selection.resolve(in: EnvironmentValues())
        return [(Double(color.red) * 255).rounded(), (Double(color.green) * 255).rounded(), (Double(color.blue) * 255).rounded()]
    }
}
