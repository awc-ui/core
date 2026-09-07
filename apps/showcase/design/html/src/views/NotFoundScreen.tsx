import { translateUi as p } from '../context';
import { dom } from '../dom';
import { Screen, Link } from '../controls';
export function NotFoundScreen(){ return <Screen title={p("That canvas is out of the picture")} subtitle={p("This design, asset or project could not be found.")}><div class="pictor-empty"><span class="material-symbols-outlined">design_services</span><Link href="/">{p("Return to your workspace")}</Link></div></Screen>; }
