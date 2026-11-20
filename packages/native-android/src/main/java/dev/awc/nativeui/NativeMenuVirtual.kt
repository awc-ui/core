package dev.awc.nativeui

/**
 * md-menu `setVirtualProvider()`: the menu's virtual data model (the source's `VirtualMenuProvider`). With a provider the menu's
 * keyboard navigation runs against the provider's (filtered) indices instead of its composed rows: ArrowUp / ArrowDown wrap past
 * disabled rows, Home / End, typeahead through [findPrefix], and Enter activates the active option in combobox mode. Only the
 * windowed rows exist as md-menu-item nodes: [ensureVisible] brings an index into the app's window before the menu focuses its
 * row (or, with a combobox, marks it active). The surface is a listbox while a provider is set.
 */
interface AWCMenuVirtualProvider {
    /** Number of rows in the current (filtered) list. */
    fun count():Int
    /** Label of the row at [index] (typeahead, accessibility). */
    fun labelAt(index:Int):String
    /** Whether the row at [index] is disabled (skipped by the arrow keys). */
    fun isDisabledAt(index:Int):Boolean
    /** Scroll [index] into the rendered window; return once the window shows it. */
    suspend fun ensureVisible(index:Int)
    /** The node id of the composed md-menu-item for [index] while it is windowed, else null (the source's `domItemForIndex`). */
    fun rowIdForIndex(index:Int):String?
    /** Typeahead: the first index at or after [from] whose label starts with [buffer] (wrapping), or -1. */
    fun findPrefix(buffer:String,from:Int):Int
}

/** `setVirtualProvider(provider)`: navigation, typeahead and roving focus run against the provider; null restores the rows. */
fun AWCMenuHandle.setVirtualProvider(provider:AWCMenuVirtualProvider?) {
    val m=controller ?: return
    m.provider=provider;m.listboxMode=provider!=null;m.virtualIndex=-1
    if(provider==null) { m.virtualRing=null;m.activeDescendant=null }
}
/**
 * `setComboboxElement(id)`: the element (its id, e.g. the search field in the menu's header) keeps focus while the provider's rows
 * are navigated; the active option is published as [activeDescendant] (the source's aria-activedescendant) and shows the focus
 * ring without taking focus. null returns to roving focus on the rows.
 */
fun AWCMenuHandle.setComboboxElement(id:String?) {
    val m=controller ?: return
    if(m.comboboxID!=id) { m.activeDescendant=null;m.virtualRing=null }
    m.comboboxID=id
}
/** The combobox's active option: the node id of the active windowed row (null while closed or without a combobox). */
val AWCMenuHandle.activeDescendant:String? get()=controller?.activeDescendant
/** The active (filtered) index of the virtual list, or -1. */
val AWCMenuHandle.virtualIndex:Int get()=controller?.virtualIndex ?: -1
/** The surface's role: listbox (the `listbox` property or a registered provider), else menu. */
val AWCMenuHandle.isListbox:Boolean get()=controller?.let { it.model.listbox || it.listboxMode } ?: false
/**
 * The menu's keydown handling for a key typed in a combobox that holds focus (the source's keydown bubbles from the header input
 * to md-menu): "ArrowDown", "ArrowUp", "Home", "End", "Enter", "Escape", "Tab" or one character. True when the menu handled it.
 * The header slot routes its focused descendants' keys here itself.
 */
fun AWCMenuHandle.handleKey(key:String,shift:Boolean=false,modified:Boolean=false):Boolean {
    val m=controller?.takeIf { it.isOpen } ?: return false
    return m.comboboxKey(key,shift,modified)
}
