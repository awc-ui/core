import { BUTTON_APPEARANCE_FIELDS } from './button-appearance.js';

export function buttonAppearanceGuide(platform) {
  const swift = platform === 'ios';
  const example = swift ? `import SwiftUI
import AWCUI

struct StyledButtonExample: View {
    var body: some View {
        VStack {
            AWCNativeView(tag: "md-button", children: [.text("Continue")])
                .awcButtonAppearance(.init(iconSize: 24, cornerRadius: 12))
        }
        .awcButtonAppearance(.init(containerColor: "#6750A4", labelColor: "#FFFFFF"))
    }
}` : `import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import dev.awc.nativeui.AWCTheme
import dev.awc.nativeui.AWCButtonAppearance
import dev.awc.nativeui.AWCButtonAppearanceScope
import dev.awc.nativeui.generated.AWCButton

@Composable
fun StyledButtonExample() {
    AWCTheme {
        AWCButtonAppearanceScope(AWCButtonAppearance(containerColor = "#6750A4", labelColor = "#FFFFFF")) {
            AWCButtonAppearanceScope(AWCButtonAppearance(iconSize = 24.0, cornerRadius = 12.0)) {
                AWCButton { slot -> if (slot == "") Text("Continue") }
            }
        }
    }
}`;
  return [
    `### Shared button appearance on ${swift ? 'iOS / SwiftUI' : 'Android / Compose'}`,
    `Use ${swift ? '\`AWCButtonAppearance\` and \`.awcButtonAppearance(...)\`' : '\`AWCButtonAppearance\` and \`AWCButtonAppearanceScope\`'} for the same semantic appearance fields as the Web button. Apply a scope around your app content for theme defaults and a nested scope around one button for local overrides. Scopes merge field by field: local values override inherited values, then source variant/size/density defaults apply. Omit a field to inherit it.`,
    '```' + (swift ? 'swift' : 'kotlin') + '\n' + example + '\n```',
    '| Field | Value | Web custom property |\n| --- | --- | --- |\n' + BUTTON_APPEARANCE_FIELDS.map(field => `| \`${field.name}\` | ${field.kind === 'color' ? '\`#RRGGBB\`' : `${field.min}–${field.max}${field.name === 'fontWeight' ? ' (integer)' : ''}`} | \`${field.cssProperty}\` |`).join('\n'),
    'Sizes and spacing use logical px on Web, points on SwiftUI and dp on Compose; Android typography uses sp and follows system font scaling; SwiftUI uses explicit point sizes and does not automatically apply Dynamic Type scaling. A requested lineHeight is a minimum; native glyph metrics can require more space. Font family remains the platform adapter’s font. Colors are six-digit hex strings; numeric fields are finite numbers. Native typed APIs ignore invalid fields so inherited valid values remain; Studio rejects invalid edits and keeps the last valid preview.',
    'Leading icon color/size also provide trailing-icon fallbacks unless its own fields are set. Authored slot content keeps its own explicit styling. Disabled container/outline colors retain 0.12 alpha and content retains 0.38; interaction overlays remain off while inert. Pressed opacity takes priority over focus, then hover. Explicit cornerRadius stays fixed instead of morphing. Padding follows the source button’s outline inset and minimum size rules.',
    'CSS parts remain Web selectors. Native equivalents already render the button surface/action, state overlay, leading/trailing glyphs, label and loader. The native appearance API customizes supported visual fields; it does not evaluate CSS selectors, layout declarations, shadow DOM or arbitrary styles. The anchor equivalent uses native navigation/action routing and shares the button surface.',
  ].join('\n\n');
}
