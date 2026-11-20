package dev.awc.playground

import android.content.Intent
import android.content.pm.ApplicationInfo
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Rect
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Base64
import android.util.Log
import android.view.InputDevice
import android.view.KeyEvent
import android.view.KeyCharacterMap
import android.view.MotionEvent
import android.view.PixelCopy
import android.view.View
import android.view.ViewTreeObserver
import android.view.WindowInsets
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredWidth
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.material3.Text
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.AWCProgressIndicatorAppearance
import dev.awc.nativeui.AWCSkeletonAppearance
import dev.awc.nativeui.AWCSnackbarAppearance
import dev.awc.nativeui.AWCSnackbarAppearanceScope
import dev.awc.nativeui.AWCSnackbarController
import dev.awc.nativeui.AWCTableController
import dev.awc.nativeui.AWCTablePaginationController
import dev.awc.nativeui.AWCChartController
import dev.awc.nativeui.AWCDialogAppearance
import dev.awc.nativeui.AWCDialogController
import dev.awc.nativeui.AWCBottomSheetAppearance
import dev.awc.nativeui.AWCBottomSheetController
import dev.awc.nativeui.AWCSideSheetAppearance
import dev.awc.nativeui.AWCSideSheetController
import dev.awc.nativeui.AWCSnackbarControllerScope
import dev.awc.nativeui.AWCSnackbarScope
import dev.awc.nativeui.AWCTooltipScope
import dev.awc.nativeui.AWCAccordionViewport
import dev.awc.nativeui.AWCAccordionItemControllerScope
import dev.awc.nativeui.AWCAccordionItemController
import dev.awc.nativeui.AWCAccordionItemAppearanceScope
import dev.awc.nativeui.AWCAccordionItemAppearance
import dev.awc.nativeui.AWCAccordionAppearanceScope
import dev.awc.nativeui.AWCAccordionAppearance
import dev.awc.nativeui.AWCCardAppearance
import dev.awc.nativeui.AWCCardAppearanceScope
import dev.awc.nativeui.AWCAvatarAppearance
import dev.awc.nativeui.AWCAvatarAppearanceScope
import dev.awc.nativeui.AWCSearchAppearance
import dev.awc.nativeui.AWCSearchAppearanceScope
import dev.awc.nativeui.AWCSearchController
import dev.awc.nativeui.AWCSearchControllerScope
import dev.awc.nativeui.AWCTransferListAppearance
import dev.awc.nativeui.AWCTransferListAppearanceScope
import dev.awc.nativeui.AWCTransferListController
import dev.awc.nativeui.AWCTransferListControllerScope
import dev.awc.nativeui.AWCOrgChartAppearance
import dev.awc.nativeui.AWCOrgChartAppearanceScope
import dev.awc.nativeui.AWCMultiSelectAppearance
import dev.awc.nativeui.AWCMultiSelectAppearanceScope
import dev.awc.nativeui.AWCMultiSelectController
import dev.awc.nativeui.AWCMultiSelectControllerScope
import dev.awc.nativeui.AWCSelectAppearance
import dev.awc.nativeui.AWCSelectAppearanceScope
import dev.awc.nativeui.AWCSelectController
import dev.awc.nativeui.AWCSelectControllerScope
import dev.awc.nativeui.AWCTextFieldAppearance
import dev.awc.nativeui.AWCTextFieldAppearanceScope
import dev.awc.nativeui.AWCTextFieldController
import dev.awc.nativeui.AWCStepperController
import dev.awc.nativeui.AWCStepperAppearance
import dev.awc.nativeui.AWCRatingController
import dev.awc.nativeui.AWCTextFieldControllerScope
import dev.awc.nativeui.AWCColorPickerController
import dev.awc.nativeui.AWCTimePickerController
import dev.awc.nativeui.AWCDatePickerController
import dev.awc.nativeui.AWCDatePickerAppearance
import dev.awc.nativeui.AWCNumberFieldAppearance
import dev.awc.nativeui.AWCNumberFieldAppearanceScope
import dev.awc.nativeui.AWCNumberFieldController
import dev.awc.nativeui.AWCNumberFieldControllerScope
import dev.awc.nativeui.AWCAutocompleteAppearance
import dev.awc.nativeui.AWCAutocompleteAppearanceScope
import dev.awc.nativeui.AWCAutocompleteController
import dev.awc.nativeui.AWCAutocompleteControllerScope
import dev.awc.nativeui.AWCMenuScope
import dev.awc.nativeui.AWCOTPFieldAppearance
import dev.awc.nativeui.AWCOTPFieldAppearanceScope
import dev.awc.nativeui.AWCOTPFieldController
import dev.awc.nativeui.AWCOTPFieldControllerScope
import dev.awc.nativeui.AWCRippleAppearance
import dev.awc.nativeui.AWCRippleAppearanceScope
import dev.awc.nativeui.AWCRippleController
import dev.awc.nativeui.AWCRippleControllerScope
import dev.awc.nativeui.AWCRippleExampleSurface
import dev.awc.nativeui.AWCBreadcrumbsAppearance
import dev.awc.nativeui.AWCBreadcrumbsAppearanceScope
import dev.awc.nativeui.AWCBreadcrumbsController
import dev.awc.nativeui.AWCBreadcrumbsControllerScope
import dev.awc.nativeui.AWCTabAppearance
import dev.awc.nativeui.AWCTabAppearanceScope
import dev.awc.nativeui.AWCTabsAppearance
import dev.awc.nativeui.AWCTabsAppearanceScope
import dev.awc.nativeui.AWCTabsController
import dev.awc.nativeui.AWCTabsControllerScope
import dev.awc.nativeui.AWCNavigationBarAppearance
import dev.awc.nativeui.AWCNavigationBarAppearanceScope
import dev.awc.nativeui.AWCNavigationBarController
import dev.awc.nativeui.AWCNavigationBarControllerScope
import dev.awc.nativeui.AWCNavigationTabAppearance
import dev.awc.nativeui.AWCNavigationTabAppearanceScope
import dev.awc.nativeui.AWCNavigationTabController
import dev.awc.nativeui.AWCNavigationTabControllerScope
import dev.awc.nativeui.AWCSwitchAppearance
import dev.awc.nativeui.AWCSwitchAppearanceScope
import dev.awc.nativeui.AWCCheckboxAppearance
import dev.awc.nativeui.AWCCheckboxAppearanceScope
import dev.awc.nativeui.AWCRadioAppearance
import dev.awc.nativeui.AWCRadioAppearanceScope
import dev.awc.nativeui.AWCChipHookAppearance
import dev.awc.nativeui.AWCChipAppearanceScope
import dev.awc.nativeui.AWCSelectionControlController
import dev.awc.nativeui.AWCSelectionControlControllerScope
import dev.awc.nativeui.AWCListAppearance
import dev.awc.nativeui.AWCListAppearanceScope
import dev.awc.nativeui.AWCListItemAppearance
import dev.awc.nativeui.AWCListItemAppearanceScope
import dev.awc.nativeui.AWCListController
import dev.awc.nativeui.AWCListControllerScope
import dev.awc.nativeui.AWCListItemController
import dev.awc.nativeui.AWCListItemControllerScope
import dev.awc.nativeui.AWCTooltipAppearance
import dev.awc.nativeui.AWCTooltipAppearanceScope
import dev.awc.nativeui.AWCTooltipController
import dev.awc.nativeui.AWCTooltipControllerScope
import dev.awc.nativeui.AWCSnackbarCloseReason
import dev.awc.nativeui.AWCSlotsScope
import dev.awc.nativeui.AWCSlotRegistry
import dev.awc.nativeui.AWCSkeletonAppearanceScope
import dev.awc.nativeui.AWCSkeletonSizingContext
import dev.awc.nativeui.AWCSkeletonSizingContextScope
import dev.awc.nativeui.AWCProgressIndicatorAppearanceScope
import dev.awc.nativeui.AWCMeterAppearance
import dev.awc.nativeui.AWCMeterAppearanceScope
import dev.awc.nativeui.AWCBadgeAppearance
import dev.awc.nativeui.AWCBadgeAppearanceScope
import dev.awc.nativeui.AWCBadgeHost
import dev.awc.nativeui.AWCStatusDotAppearance
import dev.awc.nativeui.AWCStatusDotAppearanceScope
import dev.awc.nativeui.AWCStatusDotHost
import dev.awc.nativeui.AWCDividerAppearance
import dev.awc.nativeui.AWCDividerAppearanceScope
import dev.awc.nativeui.AWCFabAppearance
import dev.awc.nativeui.AWCFabAppearanceScope
import dev.awc.nativeui.AWCFabController
import dev.awc.nativeui.AWCFabControllerScope
import dev.awc.nativeui.AWCFabMenuScope
import dev.awc.nativeui.AWCFabMenuController
import dev.awc.nativeui.AWCFabMenuControllerScope
import dev.awc.nativeui.AWCFabMenuAppearance
import dev.awc.nativeui.AWCFabMenuAppearanceScope
import dev.awc.nativeui.AWCFabMenuItemAppearance
import dev.awc.nativeui.AWCFabMenuItemAppearanceScope
import dev.awc.nativeui.AWCMenuAppearance
import dev.awc.nativeui.AWCMenuScopeState
import dev.awc.nativeui.AWCSegmentedButtonAppearance
import dev.awc.nativeui.AWCSegmentedButtonAppearanceScope
import dev.awc.nativeui.AWCSegmentedButtonSetState
import dev.awc.nativeui.AWCSegmentedButtonSetStateScope
import dev.awc.nativeui.AWCSplitButtonAppearance
import dev.awc.nativeui.AWCLoadingIndicatorAppearance
import dev.awc.nativeui.AWCLoadingIndicatorAppearanceScope
import dev.awc.nativeui.AWCSplitButtonAppearanceScope
import dev.awc.nativeui.AWCSplitButtonState
import dev.awc.nativeui.AWCSplitButtonStateScope
import dev.awc.nativeui.AWCSlotText
import dev.awc.nativeui.AWCComponent
import dev.awc.nativeui.AWCInspectionCollector
import dev.awc.nativeui.AWCInspectionScope
import dev.awc.nativeui.AWCInspectionSnapshot
import dev.awc.nativeui.AWCInspectionInsets
import dev.awc.nativeui.AWCMaterialSymbol
import dev.awc.nativeui.AWCActionEvent
import dev.awc.nativeui.AWCActionScope
import dev.awc.nativeui.AWCActionTargetScope
import dev.awc.nativeui.rememberAWCInspectionText
import dev.awc.nativeui.AWCButtonAppearance
import dev.awc.nativeui.AWCIconButtonAppearance
import dev.awc.nativeui.AWCIconButtonAppearanceScope
import dev.awc.nativeui.AWCButtonGroupAppearance
import dev.awc.nativeui.AWCButtonGroupAppearanceScope
import dev.awc.nativeui.AWCButtonGroupState
import dev.awc.nativeui.AWCButtonGroupStateScope
import dev.awc.nativeui.AWCPreviewScope
import dev.awc.nativeui.AWCButtonAppearanceScope
import dev.awc.nativeui.AWCButtonBehaviorDemo
import dev.awc.nativeui.AWCButtonNavigationDemo
import dev.awc.nativeui.AWCButtonAccessibilityDemo
import dev.awc.nativeui.AWCTheme
import dev.awc.nativeui.AWCValue
import dev.awc.nativeui.normalizeAWCThemeOverrides
import dev.awc.nativeui.generated.AWCNativeCatalog
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.util.UUID
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Debug-only Compose host. ADB forwards its authenticated loopback socket;
 * input is dispatched to this activity's views, never to the Android system.
 */
class LivePreviewActivity : ComponentActivity() {
    private data class Configuration(val tag: String, val properties: Map<String, AWCValue>, val dark: Boolean, val width: Double, val scenario: String, val themeTokens: Map<String, String>, val direction: LayoutDirection, val text: String?, val slots: Map<String, AWCValue>, val buttonAppearanceDefaults: AWCButtonAppearance, val buttonAppearance: AWCButtonAppearance, val iconButtonAppearance: AWCIconButtonAppearance, val buttonGroupAppearance: AWCButtonGroupAppearance, val buttonGroupSelection: List<Boolean>, val fabAppearance: AWCFabAppearance, val dividerAppearance: AWCDividerAppearance, val fabMenuAppearance:AWCFabMenuAppearance, val fabMenuItemAppearance:AWCFabMenuItemAppearance, val badgeAppearance:AWCBadgeAppearance, val statusDotAppearance:AWCStatusDotAppearance, val segmentedDefaults:AWCSegmentedButtonAppearance, val segmentedAppearance:AWCSegmentedButtonAppearance, val segmentedContext:LiveSegmentedContext, val splitButtonAppearance:AWCSplitButtonAppearance,val loadingIndicatorAppearance:AWCLoadingIndicatorAppearance,val meterAppearance:AWCMeterAppearance,val progressAppearance:AWCProgressIndicatorAppearance,val skeletonAppearance:AWCSkeletonAppearance,val snackbarAppearance:AWCSnackbarAppearance,val snackbarHeight:Double,val tooltipAppearance:AWCTooltipAppearance=AWCTooltipAppearance(),val accordionAppearance:AWCAccordionAppearance=AWCAccordionAppearance(),val accordionItemAppearance:AWCAccordionItemAppearance=AWCAccordionItemAppearance(),val cardAppearance:AWCCardAppearance=AWCCardAppearance(),val listAppearance:AWCListAppearance=AWCListAppearance(),val listItemAppearance:AWCListItemAppearance=AWCListItemAppearance(),val dialogAppearance:AWCDialogAppearance=AWCDialogAppearance(),val bottomSheetAppearance:AWCBottomSheetAppearance=AWCBottomSheetAppearance(),val sideSheetAppearance:AWCSideSheetAppearance=AWCSideSheetAppearance(),val avatarAppearance:AWCAvatarAppearance=AWCAvatarAppearance(),val switchAppearance:AWCSwitchAppearance=AWCSwitchAppearance(),val checkboxAppearance:AWCCheckboxAppearance=AWCCheckboxAppearance(),val radioAppearance:AWCRadioAppearance=AWCRadioAppearance(),val chipAppearance:AWCChipHookAppearance=AWCChipHookAppearance(),val rippleAppearance:AWCRippleAppearance=AWCRippleAppearance(),val searchAppearance:AWCSearchAppearance=AWCSearchAppearance(),val transferListAppearance:AWCTransferListAppearance=AWCTransferListAppearance(),val orgChartAppearance:AWCOrgChartAppearance=AWCOrgChartAppearance(),val breadcrumbsAppearance:AWCBreadcrumbsAppearance=AWCBreadcrumbsAppearance(),val tabsAppearance:AWCTabsAppearance=AWCTabsAppearance(),val tabAppearance:AWCTabAppearance=AWCTabAppearance(),val navigationBarAppearance:AWCNavigationBarAppearance=AWCNavigationBarAppearance(),val navigationTabAppearance:AWCNavigationTabAppearance=AWCNavigationTabAppearance(),val textFieldAppearance:AWCTextFieldAppearance=AWCTextFieldAppearance(),val selectAppearance:AWCSelectAppearance=AWCSelectAppearance(),val multiSelectAppearance:AWCMultiSelectAppearance=AWCMultiSelectAppearance(),val numberFieldAppearance:AWCNumberFieldAppearance=AWCNumberFieldAppearance(),val autocompleteAppearance:AWCAutocompleteAppearance=AWCAutocompleteAppearance(),val otpFieldAppearance:AWCOTPFieldAppearance=AWCOTPFieldAppearance(),val menuAppearanceDefaults:AWCMenuAppearance=AWCMenuAppearance(),val menuAppearance:AWCMenuAppearance=AWCMenuAppearance())
    private val main = Handler(Looper.getMainLooper())
    private var configuration by mutableStateOf<Configuration?>(null)
    // Snapshot state: an update whose properties equal the current ones still recomposes, draws its revision and ACKs (gate-7 R4-17).
    private var propertyRevision by mutableLongStateOf(0L)
    private var renderedPropertyRevision=0L
    private var pendingPropertyUpdate:Pair<Long,CompletableFuture<Unit>>?=null
    private var pendingResize:Pair<Pair<Double,Double>,CompletableFuture<Unit>>?=null
    private val previewDensity = 2f
    private var surface: LivePreviewSurface? = null
    private lateinit var preview: ComposeView
    private lateinit var container: FrameLayout
    private var server: LivePreviewServer? = null
    private val events = ArrayDeque<JSONObject>()
    private var downTime = 0L
    private var pointerHeld = false
    private var stream: LivePreviewServer.Stream? = null
    private val captureInFlight = AtomicBoolean(false)
    private var encodingInFlight = false
    private var pendingCapture: Pair<LivePreviewServer.Stream, Captured>? = null
    private var submittedDraw = 0L
    private var captureHoldingDraw = false
    private var captureBlockedDraw = false
    private var captureAfterCommit: (() -> Unit)? = null
    private val queuedCaptures = ArrayDeque<() -> Unit>()
    private var committedDraw = 0L
    /** Layout-only traversals in submission order, accepted once every earlier submission committed. */
    private val undrawnSubmissions = ArrayDeque<Pair<Long, Runnable>>()
    private var capturedDraw = -1L
    private var captureSequence = 0L
    private var droppedCaptures = 0L
    private var cachedFrame: JSONObject? = null
    private val inspectionCollector = AWCInspectionCollector()
    private val buttonGroupState = AWCButtonGroupState()
    private val splitButtonState=AWCSplitButtonState()
    private var committedSplitButtonChecked:Boolean?=null
    private val segmentedState=AWCSegmentedButtonSetState()
    private var committedSegmentedSelection:List<Boolean>?=null
    private val fabController = AWCFabController()
    private val fabMenuController=AWCFabMenuController()
    private val menuState=AWCMenuScopeState()
    /** md-menu show([{ autoFocus }]) / close() / whenClosed() on the recipe menu (whenClosed resolves after the exit). */
    private val menuMethodCalls=LivePreviewMethodCalls(invoke={method,args->
        val handle=menuState.menu(LIVE_MENU_ID)
        when(method) { "show"->handle.show(autoFocus=args.firstOrNull()?.toBooleanStrictOrNull()); "close"->handle.close(); else->handle.whenClosed() }
    },validate=::validateLivePreviewMenuMethod)
    private val tooltipController=AWCTooltipController()
    private val accordionItemController=AWCAccordionItemController()
    private val listController=AWCListController()
    private val transferListController=AWCTransferListController()
    private val listItemController=AWCListItemController()
    private val selectionController=AWCSelectionControlController()
    private val rippleController=AWCRippleController()
    private val searchController=AWCSearchController()
    private val breadcrumbsController=AWCBreadcrumbsController()
    private val tabsController=AWCTabsController()
    private val navigationBarController=AWCNavigationBarController()
    private val navigationTabController=AWCNavigationTabController()
    private val textFieldController=AWCTextFieldController()
    private val selectController=AWCSelectController()
    private val multiSelectController=AWCMultiSelectController()
    private val colorPickerController=AWCColorPickerController()
    private val timePickerController=AWCTimePickerController()
    private val datePickerController=AWCDatePickerController()
    private var datePickerAppearance=AWCDatePickerAppearance()
    private var pickerAppearances=LivePreviewPickerAppearances()
    private val numberFieldController=AWCNumberFieldController()
    private val autocompleteController=AWCAutocompleteController()
    private val otpFieldController=AWCOTPFieldController()
    private val stepperController=AWCStepperController()
    private var stepperOptions=AWCStepperAppearance()
    private val srRatingController=AWCRatingController()
    private var srOptions=LivePreviewSROptions()
    private val tableController=AWCTableController()
    private val tablePaginationController=AWCTablePaginationController()
    private var tableOptions=LivePreviewTableOptions()
    private val chartController=AWCChartController()
    private var chartOptions=LivePreviewChartOptions()
    private val navControllers=LivePreviewNavControllers()
    private var navOptions=LivePreviewNavOptions()
    private val dialogController=AWCDialogController()
    private val bottomSheetController=AWCBottomSheetController()
    private val sideSheetController=AWCSideSheetController()
    /** show/close apply immediately; whenClosed resolves after the open cycle and the exit motion. */
    private val modalMethodCalls=LivePreviewMethodCalls(invoke={method,_->
        when(configuration?.tag) {
            "md-dialog"->when(method) { "show"->dialogController.show(); "close"->dialogController.close(); else->dialogController.whenClosed() }
            "md-bottom-sheet"->if(method=="show") bottomSheetController.show() else bottomSheetController.close()
            else->when(method) { "show"->sideSheetController.show(); "close"->sideSheetController.close(); else->sideSheetController.whenClosed() }
        }
    },validate={method,args->validateLivePreviewModalMethod(configuration?.tag ?: "",method,args)})
    private var listMethodResult:Any?=null
    private val tooltipMethodCalls=LivePreviewMethodCalls(invoke={method,_->
        if(method=="show") tooltipController.show() else tooltipController.hide()
    },validate=::parseLivePreviewTooltipMethod)
    private val snackbarController=AWCSnackbarController()
    private val snackbarMethodCalls=LivePreviewMethodCalls(invoke={method,args->
        if(method=="show") snackbarController.show()
        else snackbarController.hide(AWCSnackbarCloseReason.entries.single { it.source==(args.firstOrNull() ?: "close") })
    },validate=::parseLivePreviewSnackbarMethod)
    private val methodCalls=LivePreviewMethodCalls { method->
        when(method) { "show"->fabMenuController.show();"close"->fabMenuController.close();"whenClosed"->fabMenuController.whenClosed() }
    }
    private var committedButtonGroupSelection: List<Boolean>? = null
    private var committedInspection: AWCInspectionSnapshot? = null
    private val pendingNativeActions = ArrayDeque<AWCActionEvent>()
    private val firstDraw = CompletableFuture<Unit>()
    private val destroyed = AtomicBoolean(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // There is deliberately no live-preview activity in the release manifest.
        if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE == 0) { finish(); return }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        // The physical Activity only owns lifecycle and authentication. The
        // private Presentation below owns native pixels and receives local input.
        setContentView(FrameLayout(this).apply { setBackgroundColor(Color.WHITE) })
        hideSystemUI()
        startHost(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // A new token is a new session: recreate the host rather than retaining old state.
        server?.close()
        stopStream()
        setIntent(intent)
        recreate()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemUI()
    }

    private fun startHost(intent: Intent) {
        val token = intent.getStringExtra("token")
        if (token == null || !token.matches(Regex("[A-Za-z0-9_-]{32,128}"))) { finish(); return }
        try {
            server = LivePreviewServer(token, command = ::command, openStream = ::openStream).also { it.start() }
        } catch (error: Exception) {
            Log.e("AWCNativeHost", "Could not open the private preview listener.", error)
            finish()
        }
    }

    override fun onDestroy() {
        destroyed.set(true)
        pendingPropertyUpdate?.second?.completeExceptionally(IllegalStateException("Native session closed during property update."))
        pendingPropertyUpdate=null
        pendingResize?.second?.completeExceptionally(IllegalStateException("Native session closed during resize."))
        pendingResize=null
        methodCalls.dispose()
        snackbarMethodCalls.dispose()
        modalMethodCalls.dispose()
        menuMethodCalls.dispose()
        tooltipMethodCalls.dispose()
        stopStream()
        if (::preview.isInitialized) cancelPointer()
        server?.close()
        if (::preview.isInitialized && preview.viewTreeObserver.isAlive) preview.viewTreeObserver.removeOnPreDrawListener(drawListener)
        surface?.close()
        surface = null
        super.onDestroy()
    }

    @Suppress("DEPRECATION")
    private fun hideSystemUI() {
        surface?.hideSystemUI()
        if (Build.VERSION.SDK_INT >= 30) {
            window.setDecorFitsSystemWindows(false)
            window.insetsController?.hide(WindowInsets.Type.systemBars() or WindowInsets.Type.ime())
        } else {
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        }
    }

    private fun recordEvent(name: String, detail: AWCValue) {
        val tag = configuration?.tag ?: return
        // Methods and native timers mutate the source open property. Reflect
        // that actual value into the retained host baseline so a later explicit
        // {open:true} is a real edge after hide(), not an ignored stale value.
        if(tag in setOf("md-snackbar","md-tooltip","md-dialog","md-bottom-sheet","md-side-sheet","md-time-picker","md-color-picker","md-date-picker","md-search") && name in setOf("mdOpen","mdClose")) {
            configuration?.let { config->
                val open=name=="mdOpen"
                if(config.properties["open"]!=open) configuration=config.copy(properties=config.properties+("open" to open))
            }
        }
        if (events.size >= 256) {
            // A bounded session must fail rather than silently lose a native callback.
            stopStream()
            server?.close()
            finish()
            return
        }
        val recorded = JSONObject().put("id", UUID.randomUUID().toString()).put("name", name)
            .put("tag", tag).put("nodeID", "$tag-preview").put("detail", JSONObject.wrap(detail))
        // Capture observes the actual event object before native dispatch. The
        // legacy callback runs afterward, so these are its final cancellation
        // flags and path, including listeners that stopped bubbling.
        val action = pendingNativeActions.lastOrNull { it.name == name && (it.detail === detail || detail==null && it.detail.isEmpty() || it.tag=="md-segmented-button-set" && it.detail["values"]===detail) }
        if (action != null) {
            pendingNativeActions.remove(action)
            val activation = JSONObject().put("source", action.activation.source)
            action.activation.x?.let { activation.put("x", it) }
            action.activation.y?.let { activation.put("y", it) }
            recorded.put("activation", activation).put("defaultPrevented", action.defaultPrevented)
                .put("propagationPath", JSONArray(action.path))
            if(tag in setOf("md-fab-menu","md-segmented-button","md-segmented-button-set")) recorded.put("tag",action.tag).put("nodeID",action.targetID)
            if(tag=="md-button-group" && action.tag!="md-button-group") recorded.put("tag",action.tag).put("nodeID",action.targetID)
        }
        events.addLast(recorded)
    }

    private fun drainEvents(): JSONArray = JSONArray().also { result -> while (events.isNotEmpty()) result.put(events.removeFirst()) }

    /** Gate-7 R1-15 (d2 host robustness): a retained update, method or input can take effect a frame or more after the
     * draw that answered it (an effect keyed on the new properties, an animation whose first frame equals the frame
     * before it). Wait until three display frames have run without submitting a draw (nothing more to draw), or, while
     * draws keep coming (motion), until three have been submitted; at most 300 ms. Frames and draws are counted, not
     * milliseconds: a slow frame under load is neither taken for quiet nor waited out. The capture that follows waits for
     * the last submitted draw to commit, so the frame shows the command. Stream-mode inputs do not wait. */
    private fun settleDraws() {
        val start=SystemClock.uptimeMillis()
        val settled=CompletableFuture<Unit>()
        main.post {
            val choreographer=android.view.Choreographer.getInstance()
            val first=submittedDraw
            var seen=first;var idle=0
            choreographer.postFrameCallback(object:android.view.Choreographer.FrameCallback {
                // Posted from the frame callback, the check runs after that frame's traversal: `submittedDraw` includes its draw.
                override fun doFrame(frameTimeNanos:Long) { main.post {
                    if(submittedDraw==seen) idle++ else { idle=0;seen=submittedDraw }
                    if(destroyed.get() || idle>=3 || submittedDraw-first>=3 || SystemClock.uptimeMillis()-start>=300) settled.complete(Unit)
                    else choreographer.postFrameCallback(this)
                } }
            })
        }
        try { settled.get(400,TimeUnit.MILLISECONDS) } catch(_:java.util.concurrent.TimeoutException) {}
    }

    private fun <T> onMain(block: () -> T): T {
        check(Looper.myLooper() != Looper.getMainLooper()) { "HTTP work must remain off the Android UI thread." }
        val result = CompletableFuture<T>()
        main.post {
            if (destroyed.get()) result.completeExceptionally(IllegalStateException("Preview activity closed."))
            else try { result.complete(block()) } catch (error: Exception) { result.completeExceptionally(error) }
        }
        return result.get(5, TimeUnit.SECONDS)
    }

    private fun command(request: JSONObject): JSONObject {
        val name = request.optString("command")
        if (name == "close") {
            // Finish this token-owned Activity in the close operation itself.
            // A delayed finish can race a new singleTask intent and kill its replacement.
            onMain {
                stopStream()
                cancelPointer()
                // onDestroy may run after the next activity has already been
                // created. Release the listener before ending this command.
                server?.close()
                server = null
                finish()
            }
            return JSONObject().put("ack", true).put("events", JSONArray())
        }
        if (name == "configure") {
            onMain { configure(request) }
            // A frame-commit callback ensures the first GPU window buffer exists.
            try { firstDraw.get(5, TimeUnit.SECONDS) } catch (error: java.util.concurrent.TimeoutException) {
                throw IllegalStateException(onMain { "Native first draw timed out (${preview.width}×${preview.height}, hardware=${preview.isHardwareAccelerated}, attached=${preview.isAttachedToWindow})." }, error)
            }
            return frame()
        }
        if(name=="resize") {
            val applied=onMain {
                val config=requireConfigured()
                require(config.tag in setOf("md-snackbar","md-tooltip","md-dialog","md-bottom-sheet","md-side-sheet","md-time-picker","md-color-picker","md-date-picker","md-search")) { "Retained viewport resize requires a native viewport component." }
                val (width,height)=parseLivePreviewSnackbarResize(request)
                check(pendingResize==null) { "A viewport resize is already pending." }
                if(width==config.width && height==config.snackbarHeight) CompletableFuture.completedFuture(Unit)
                else CompletableFuture<Unit>().also { future ->
                    pendingResize=(width to height) to future
                    surface!!.resize(width)
                    configuration=config.copy(width=width,snackbarHeight=height)
                }
            }
            applied.get(5,TimeUnit.SECONDS)
            // A VirtualDisplay resize may replace the window surface just after
            // its layout commit. Wait for another actual draw when that fresh
            // surface has not queued a GPU buffer yet; never ACK stale pixels.
            repeat(3) { attempt ->
                try { return frame().put("ack",true) }
                catch(error:Exception) {
                    val cause=generateSequence<Throwable>(error) { it.cause }.last()
                    if(attempt==2 || cause.message?.contains("Native PixelCopy failed with code 3")!=true) throw error
                    onMain {
                        val config=requireConfigured()
                        CompletableFuture<Unit>().also { future->
                            pendingResize=(config.width to config.snackbarHeight) to future
                            preview.postInvalidateOnAnimation()
                        }
                    }.get(5,TimeUnit.SECONDS)
                }
            }
            error("Native resize capture was not completed.")
        }
        if(name=="update") {
            val applied=onMain {
                val config=requireConfigured()
                val patch=when(config.tag) {
                    "md-progress-indicator"->parseLivePreviewProgressUpdate(request)
                    "md-skeleton"->parseLivePreviewSkeletonUpdate(request)
                    "md-badge","md-loading-indicator","md-meter","md-status-dot"->parseLivePreviewCommunicationUpdate(config.tag,request) // R2-D6
                    "md-snackbar"->parseLivePreviewSnackbarUpdate(request)
                    "md-tooltip"->parseLivePreviewTooltipUpdate(request)
                    "md-accordion","md-accordion-item"->parseLivePreviewAccordionUpdate(request,config.tag)
                    "md-card"->parseLivePreviewCardUpdate(request)
                    "md-avatar"->parseLivePreviewAvatarUpdate(request)
                    "md-transfer-list"->parseLivePreviewTransferListUpdate(request)
                    "md-organization-chart"->parseLivePreviewOrgChartUpdate(request)
                    "md-switch","md-checkbox","md-radio","md-chip"->parseLivePreviewSelectionUpdate(config.tag,request)
                    "md-ripple"->parseLivePreviewRippleUpdate(request)
                    "md-search"->parseLivePreviewSearchUpdate(request)
                    "md-divider"->parseLivePreviewDividerUpdate(request) // gate-7 r3-03
                    "md-breadcrumbs","md-breadcrumb-item"->parseLivePreviewBreadcrumbsUpdate(request,config.tag)
                    "md-tabs","md-tab","md-tab-panels","md-tab-panel"->parseLivePreviewTabsUpdate(request,config.tag)
                    "md-navigation-bar","md-navigation-tab"->parseLivePreviewNavigationUpdate(request,config.tag)
                    in livePreviewNavTags->parseLivePreviewNavUpdate(config.tag,request)
                    in livePreviewChartTags->parseLivePreviewChartUpdate(config.tag,request)
                    in livePreviewTableUpdateTags->parseLivePreviewTableUpdate(config.tag,request)
                    in livePreviewSRTags->parseLivePreviewSRUpdate(config.tag,request)
                    in livePreviewStepperTags->parseLivePreviewStepperUpdate(config.tag,request)
                    "md-date-picker"->parseLivePreviewDatePickerUpdate(request)
                    "md-color-picker","md-time-picker"->parseLivePreviewPickerUpdate(config.tag,request)
                    "md-text-field"->parseLivePreviewTextFieldUpdate(request)
                    "md-select","md-multi-select"->parseLivePreviewSelectUpdate(request,config.tag)
                    "md-number-field"->parseLivePreviewNumberFieldUpdate(request)
                    "md-autocomplete"->parseLivePreviewAutocompleteUpdate(request)
                    "md-otp-field"->parseLivePreviewOTPFieldUpdate(request)
                    "md-list","md-list-item"->parseLivePreviewListUpdate(request,config.tag)
                    "md-dialog","md-bottom-sheet","md-side-sheet"->parseLivePreviewModalUpdate(request,config.tag)
                    "md-menu","md-menu-item","md-menu-item-group","md-sub-menu-item"->parseLivePreviewMenuUpdate(request,config.tag)
                    in livePreviewButtonFamilyTags->parseLivePreviewButtonFamilyUpdate(config.tag,request) // gate-7 R1-04
                    else->throw IllegalArgumentException("Retained updates are not supported for this component.")
                }
                check(pendingPropertyUpdate==null) { "A property update is already pending." }
                CompletableFuture<Unit>().also { future ->
                    propertyRevision++
                    pendingPropertyUpdate=propertyRevision to future
                    val properties=config.properties+patch
                    configuration=config.copy(properties=if(config.tag=="md-tooltip" && properties["disabled"]==true)
                        properties+("open" to false) else properties,
                        // A retained update of a mounted set reaches its rendered context (gate-7 R1-04).
                        segmentedContext=if(config.tag=="md-segmented-button-set") config.segmentedContext.copy(multiselect=(patch["multiselect"] as? Boolean) ?: config.segmentedContext.multiselect,
                            density=(patch["density"] as? Number)?.toInt() ?: config.segmentedContext.density) else config.segmentedContext)
                }
            }
            applied.get(5,TimeUnit.SECONDS)
            settleDraws()
            return onMain { JSONObject().put("ack",true).put("events",drainEvents()) }
        }
        if (name == "frame") { onMain { requireConfigured() }; return frame() }
        if(name=="method-results" || name=="method" && request.has("callId")) return onMain {
            val accepting=name=="method"
            val calls=when(requireConfigured().tag) {
                "md-fab-menu"->methodCalls
                "md-snackbar"->snackbarMethodCalls
                "md-tooltip"->tooltipMethodCalls
                "md-dialog","md-bottom-sheet","md-side-sheet"->modalMethodCalls
                "md-menu"->menuMethodCalls
                else->throw IllegalArgumentException("Deferred methods are not supported for this component.")
            }
            JSONObject().put("ack",true).put("events",drainEvents()).also {
                if(name=="method-results") it.put("methodResults",calls.results(request))
                else it.put("methodCall",calls.accept(request))
            } to accepting
        }.let { (reply,accepted)-> if(accepted) settleDraws(); reply }
        val (reply, streaming) = onMain {
            requireConfigured()
            val notice = when (name) {
                "click" -> { click(request); null }
                "pointer" -> { pointer(request); null }
                "text" -> insertText(request)
                "key" -> key(request)
                "method" -> if(requireConfigured().tag in setOf("md-list","md-list-item")) {
                    listMethodResult=invokeLivePreviewListMethod(requireConfigured().tag,request,listController,listItemController)
                    null
                } else if(requireConfigured().tag in livePreviewNavMethodTags) {
                    listMethodResult=invokeLivePreviewNavMethod(requireConfigured().tag,request,navControllers)
                    null
                } else if(requireConfigured().tag in livePreviewChartMethodTags) {
                    listMethodResult=invokeLivePreviewChartMethod(requireConfigured().tag,request,chartController)
                    null
                } else if(requireConfigured().tag in livePreviewTableMethodTags) {
                    listMethodResult=invokeLivePreviewTableMethod(requireConfigured().tag,request,requireConfigured().properties["id"] as? String ?: "",tableController,tablePaginationController)
                    null
                } else if(requireConfigured().tag in livePreviewSRMethodTags) {
                    listMethodResult=invokeLivePreviewSRMethod(requireConfigured().tag,request,srRatingController)
                    null
                } else if(requireConfigured().tag in livePreviewStepperMethodTags) {
                    listMethodResult=invokeLivePreviewStepperMethod(requireConfigured().tag,request,stepperController)
                    null
                } else if(requireConfigured().tag=="md-otp-field") {
                    listMethodResult=invokeLivePreviewOTPFieldMethod(request,otpFieldController)
                    null
                } else if(requireConfigured().tag=="md-autocomplete") {
                    listMethodResult=invokeLivePreviewAutocompleteMethod(request,autocompleteController)
                    null
                } else if(requireConfigured().tag=="md-number-field") {
                    listMethodResult=invokeLivePreviewNumberFieldMethod(request,numberFieldController)
                    null
                } else if(requireConfigured().tag=="md-date-picker") {
                    listMethodResult=invokeLivePreviewDatePickerMethod(request,datePickerController)
                    null
                } else if(requireConfigured().tag in setOf("md-color-picker","md-time-picker")) {
                    listMethodResult=invokeLivePreviewPickerMethod(requireConfigured().tag,request,colorPickerController,timePickerController)
                    null
                } else if(requireConfigured().tag in livePreviewSelectTags) {
                    listMethodResult=invokeLivePreviewSelectMethod(requireConfigured().tag,request,selectController,multiSelectController)
                    null
                } else if(requireConfigured().tag=="md-text-field") {
                    listMethodResult=invokeLivePreviewTextFieldMethod(request,textFieldController)
                    null
                } else if(requireConfigured().tag in setOf("md-navigation-bar","md-navigation-tab")) {
                    listMethodResult=invokeLivePreviewNavigationMethod(requireConfigured().tag,request,navigationBarController,navigationTabController)
                    null
                } else if(requireConfigured().tag=="md-tabs") {
                    listMethodResult=invokeLivePreviewTabsMethod(request,tabsController)
                    null
                } else if(requireConfigured().tag=="md-breadcrumbs") {
                    listMethodResult=invokeLivePreviewBreadcrumbsMethod(request,breadcrumbsController)
                    null
                } else if(requireConfigured().tag in setOf("md-menu","md-sub-menu-item")) {
                    listMethodResult=invokeLivePreviewMenuMethod(requireConfigured().tag,request,menuState)
                    null
                } else if(requireConfigured().tag=="md-transfer-list") {
                    listMethodResult=invokeLivePreviewTransferListMethod(request,transferListController)
                    null
                } else if(requireConfigured().tag=="md-search") {
                    listMethodResult=invokeLivePreviewSearchMethod(request,searchController)
                    null
                } else if(requireConfigured().tag=="md-ripple") {
                    listMethodResult=invokeLivePreviewRippleMethod(request,rippleController)
                    null
                } else if(requireConfigured().tag in setOf("md-switch","md-checkbox","md-radio")) {
                    listMethodResult=invokeLivePreviewSelectionMethod(requireConfigured().tag,request,selectionController)
                    null
                } else if(requireConfigured().tag=="md-accordion-item" && request.optString("method") in setOf("toggle","focusHeader")) {
                    require(request.getJSONArray("arguments").length()==0) { "${request.optString("method")} requires no arguments." }
                    check(accordionItemController.isConnected) { "The accordion item is not mounted." }
                    if(request.optString("method")=="toggle") accordionItemController.toggle() else accordionItemController.focusHeader()
                    null
                } else {
                    require(requireConfigured().tag=="md-fab" && request.optString("method")=="setMenuIcon") { "Unsupported native method." }
                    val args=request.getJSONArray("arguments")
                    require(args.length()==1 && (args.isNull(0) || args.get(0) is String)) { "setMenuIcon requires one string or null." }
                    check(fabController.setMenuIcon(if(args.isNull(0)) null else args.getString(0))) { "FAB method target is not attached." }
                    null
                }
                "stream" -> {
                    require(request.has("enabled") && request.get("enabled") is Boolean) { "Stream requires an enabled boolean." }
                    if (!request.getBoolean("enabled")) stopStream()
                    null
                }
                else -> throw IllegalArgumentException("Unsupported native command: $name")
            }
            if (name == "click" || name == "text" || name == "key") hideSystemUI()
            JSONObject().put("ack", true).put("events", drainEvents()).also { if (notice != null) it.put("inputIgnored", notice)
                listMethodResult?.let { result-> it.put("result",result) };listMethodResult=null } to (stream != null)
        }
        if (name == "stream" || streaming) return reply
        settleDraws()
        val rendered = frame()
        val combined = reply.getJSONArray("events")
        val later = rendered.getJSONArray("events")
        for (i in 0 until later.length()) combined.put(later.get(i))
        rendered.put("events", combined)
        if(name=="method") rendered.put("ack",true)
        if (reply.has("inputIgnored")) rendered.put("inputIgnored", reply.getString("inputIgnored"))
        if (reply.has("result")) rendered.put("result", reply.get("result"))
        return rendered
    }

    private fun configure(request: JSONObject) {
        check(configuration == null) { "A native session can only be configured once." }
        stepperOptions=parseLivePreviewStepperOptions(request)
        srOptions=parseLivePreviewSROptions(request)
        chartOptions=parseLivePreviewChartOptions(request)
        navOptions=parseLivePreviewNavOptions(request)
        val tag = request.optString("tag")
        require(tag in AWCNativeCatalog.tags) { "Unknown native component tag." }
        val text = parseLivePreviewButtonText(request, tag)
        val slots = parseLivePreviewSlots(request, tag)
        LivePreviewNodeOverride.set(tag, request.optJSONArray("children"))   // the shared example's children (LivePreviewNode.kt)
        // md-table family: the selected member's typed hooks, and the SwiftUI host's example table as the children (LivePreviewTable.kt).
        if(tag in livePreviewTableTags) { tableOptions=parseLivePreviewTableOptions(request); if(!request.has("children")) LivePreviewNodeOverride.set(tag, livePreviewTableExampleChildren(tag)) }
        val width = request.optDouble("width", 640.0)
        require(width.isFinite() && width in 320.0..1200.0) { "Width must be finite and between 320 and 1200." }
        val snackbarHeight=parseLivePreviewSnackbarHeight(request,tag,width)
        val tooltipAppearance=if(tag=="md-tooltip") parseLivePreviewTooltipAppearance(request,"tooltipAppearanceDefaults").merged(parseLivePreviewTooltipAppearance(request,"tooltipAppearance")) else AWCTooltipAppearance()
        val snackbarAppearance=if(tag=="md-snackbar") parseLivePreviewSnackbarAppearance(request,"snackbarAppearanceDefaults").merged(parseLivePreviewSnackbarAppearance(request,"snackbarAppearance")) else AWCSnackbarAppearance()
        val supplied = request.optJSONObject("properties") ?: JSONObject()
        @Suppress("UNCHECKED_CAST")
        val properties = jsonValue(supplied) as Map<String, AWCValue>
        val dark = request.optBoolean("dark", false)
        val scenario = request.optString("scenario", "")
        require(scenario.isEmpty() || (scenario in setOf("button-behavior", "navigation-events", "focus-accessibility") && tag == "md-button")) { "Unknown native example." }
        val direction = request.optString("direction", "ltr")
        require(direction in setOf("ltr", "rtl")) { "Direction must be ltr or rtl." }
        val themeTokens = if (request.has("themeTokens")) {
            val colors = request.getJSONObject("themeTokens")
            normalizeAWCThemeOverrides(colors.keys().asSequence().associateWith { name ->
                val value = colors.get(name)
                require(value is String) { "Native theme colors must be strings." }
                value
            })
        } else emptyMap()
        val appearanceDefaults = parseLivePreviewButtonAppearance(request, "buttonAppearanceDefaults")
        val appearance = if(tag == "md-button") parseLivePreviewButtonAppearance(request, "buttonAppearance") else AWCButtonAppearance()
        val iconAppearance = if(tag == "md-icon-button")
            parseLivePreviewIconButtonAppearance(request,"iconButtonAppearanceDefaults").merged(parseLivePreviewIconButtonAppearance(request,"iconButtonAppearance"))
            else AWCIconButtonAppearance()
        val groupAppearance=if(tag=="md-button-group") parseLivePreviewButtonGroupAppearance(request,"buttonGroupAppearanceDefaults").merged(parseLivePreviewButtonGroupAppearance(request,"buttonGroupAppearance")) else AWCButtonGroupAppearance()
        val dividerAppearance=if(tag=="md-divider") parseLivePreviewDividerAppearance(request,"dividerAppearanceDefaults").merged(parseLivePreviewDividerAppearance(request,"dividerAppearance")) else AWCDividerAppearance()
        val fabAppearance=if(tag=="md-fab") parseLivePreviewFabAppearance(request,"fabAppearanceDefaults").merged(parseLivePreviewFabAppearance(request,"fabAppearance")) else AWCFabAppearance()
        val menuAppearance=if(tag=="md-fab-menu") parseLivePreviewFabMenuAppearance(request,"fabMenuAppearanceDefaults").merged(parseLivePreviewFabMenuAppearance(request,"fabMenuAppearance")) else AWCFabMenuAppearance()
        val itemAppearance=if(tag=="md-fab-menu-item") parseLivePreviewFabMenuItemAppearance(request,"fabMenuItemAppearanceDefaults").merged(parseLivePreviewFabMenuItemAppearance(request,"fabMenuItemAppearance")) else AWCFabMenuItemAppearance()
        val badgeAppearance=if(tag=="md-badge") parseLivePreviewBadgeAppearance(request,"badgeAppearanceDefaults").merged(parseLivePreviewBadgeAppearance(request,"badgeAppearance")) else AWCBadgeAppearance()
        val statusDotAppearance=if(tag=="md-status-dot") parseLivePreviewStatusDotAppearance(request,"statusDotAppearanceDefaults").merged(parseLivePreviewStatusDotAppearance(request,"statusDotAppearance")) else AWCStatusDotAppearance()
        val loadingAppearance=if(tag=="md-loading-indicator") parseLivePreviewLoadingAppearance(request,"loadingIndicatorAppearanceDefaults").merged(parseLivePreviewLoadingAppearance(request,"loadingIndicatorAppearance")) else AWCLoadingIndicatorAppearance()
        val meterAppearance=if(tag=="md-meter") parseLivePreviewMeterAppearance(request,"meterAppearanceDefaults").merged(parseLivePreviewMeterAppearance(request,"meterAppearance")) else AWCMeterAppearance()
        val progressAppearance=if(tag=="md-progress-indicator") parseLivePreviewProgressAppearance(request,"progressIndicatorAppearanceDefaults").merged(parseLivePreviewProgressAppearance(request,"progressIndicatorAppearance")) else AWCProgressIndicatorAppearance()
        val skeletonAppearance=if(tag=="md-skeleton") parseLivePreviewSkeletonAppearance(request,"skeletonAppearanceDefaults").merged(parseLivePreviewSkeletonAppearance(request,"skeletonAppearance")) else AWCSkeletonAppearance()
        val splitButtonAppearance=if(tag=="md-split-button") parseLivePreviewSplitButtonAppearance(request,"splitButtonAppearanceDefaults").merged(parseLivePreviewSplitButtonAppearance(request,"splitButtonAppearance")) else AWCSplitButtonAppearance()
        val segmentedDefaults=parseLivePreviewSegmentedAppearance(request,"segmentedButtonAppearanceDefaults")
        val segmentedAppearance=parseLivePreviewSegmentedAppearance(request,"segmentedButtonAppearance")
        val segmentedContext=parseLiveSegmentedContext(request,tag)
        val groupSelection=if(request.has("buttonGroupSelection")) {
            require(tag=="md-button-group") { "Child selection is only supported for a button group." }
            val items=request.getJSONArray("buttonGroupSelection")
            require(items.length()==3 && (0 until items.length()).all { items.get(it) is Boolean }) { "Button group selection must contain three Boolean child states." }
            (0 until items.length()).map { items.getBoolean(it) }
        } else listOf(true,false,false)
        pickerAppearances=parseLivePreviewPickerAppearances(request,tag)
        datePickerAppearance=parseLivePreviewDatePickerAppearance(request,tag)
        inspectionCollector.clear()
        committedInspection = null
        committedSplitButtonChecked=null
        val recipe=livePreviewMenuRecipe(tag) ?: if(tag=="md-fab-menu") mapOf("anchor" to "demo-fab-anchor","placement" to "down") else if(tag=="md-segmented-button") mapOf("label" to "Day","value" to "day","selected" to true) else emptyMap()
        // A shared example (`children`, LivePreviewNode.kt) carries complete properties: the host's own sample fixture stays out.
        configuration = Configuration(tag, AWCNativeCatalog.defaults[tag].orEmpty() + (if(request.has("children")) emptyMap() else fixture(tag)) + recipe + properties, dark, width, scenario, themeTokens, if(direction == "rtl") LayoutDirection.Rtl else LayoutDirection.Ltr, text, slots, appearanceDefaults, appearance, iconAppearance, groupAppearance, groupSelection, fabAppearance, dividerAppearance,menuAppearance,itemAppearance,badgeAppearance,statusDotAppearance,segmentedDefaults,segmentedAppearance,segmentedContext,splitButtonAppearance,loadingAppearance,meterAppearance,progressAppearance,skeletonAppearance,snackbarAppearance,snackbarHeight,tooltipAppearance,accordionAppearance=if(tag=="md-accordion") parseLivePreviewAccordionAppearance(request,"accordionAppearanceDefaults").merged(parseLivePreviewAccordionAppearance(request,"accordionAppearance")) else AWCAccordionAppearance(),accordionItemAppearance=if(tag=="md-accordion-item") parseLivePreviewAccordionItemAppearance(request,"accordionItemAppearanceDefaults").merged(parseLivePreviewAccordionItemAppearance(request,"accordionItemAppearance")) else AWCAccordionItemAppearance(),cardAppearance=if(tag=="md-card") parseLivePreviewCardAppearance(request,"cardAppearanceDefaults").merge(parseLivePreviewCardAppearance(request,"cardAppearance")) else AWCCardAppearance(),listAppearance=if(tag=="md-list") parseLivePreviewListAppearance(request,"listAppearanceDefaults").merge(parseLivePreviewListAppearance(request,"listAppearance")) else AWCListAppearance(),listItemAppearance=if(tag in setOf("md-list","md-list-item")) parseLivePreviewListItemAppearance(request,"listItemAppearanceDefaults").merge(parseLivePreviewListItemAppearance(request,"listItemAppearance")) else AWCListItemAppearance(),dialogAppearance=if(tag=="md-dialog") parseLivePreviewDialogAppearance(request,"dialogAppearanceDefaults").merge(parseLivePreviewDialogAppearance(request,"dialogAppearance")) else AWCDialogAppearance(),bottomSheetAppearance=if(tag=="md-bottom-sheet") parseLivePreviewBottomSheetAppearance(request,"bottomSheetAppearanceDefaults").merge(parseLivePreviewBottomSheetAppearance(request,"bottomSheetAppearance")) else AWCBottomSheetAppearance(),sideSheetAppearance=if(tag=="md-side-sheet") parseLivePreviewSideSheetAppearance(request,"sideSheetAppearanceDefaults").merge(parseLivePreviewSideSheetAppearance(request,"sideSheetAppearance")) else AWCSideSheetAppearance(),avatarAppearance=if(tag=="md-avatar") parseLivePreviewAvatarAppearance(request,"avatarAppearanceDefaults").merge(parseLivePreviewAvatarAppearance(request,"avatarAppearance")) else AWCAvatarAppearance(),switchAppearance=if(tag=="md-switch") parseLivePreviewSwitchAppearance(request) else AWCSwitchAppearance(),checkboxAppearance=if(tag=="md-checkbox") parseLivePreviewCheckboxAppearance(request) else AWCCheckboxAppearance(),radioAppearance=if(tag=="md-radio") parseLivePreviewRadioAppearance(request) else AWCRadioAppearance(),chipAppearance=if(tag=="md-chip") parseLivePreviewChipAppearance(request) else AWCChipHookAppearance(),rippleAppearance=if(tag=="md-ripple") parseLivePreviewRippleAppearance(request) else AWCRippleAppearance(),searchAppearance=if(tag=="md-search") parseLivePreviewSearchAppearance(request) else AWCSearchAppearance(),transferListAppearance=if(tag=="md-transfer-list") parseLivePreviewTransferListAppearance(request) else AWCTransferListAppearance(),orgChartAppearance=if(tag=="md-organization-chart") parseLivePreviewOrgChartAppearance(request) else AWCOrgChartAppearance(),breadcrumbsAppearance=if(tag in setOf("md-breadcrumbs","md-breadcrumb-item")) parseLivePreviewBreadcrumbsAppearance(request,tag) else AWCBreadcrumbsAppearance(),tabsAppearance=if(tag=="md-tabs") parseLivePreviewTabsAppearance(request) else AWCTabsAppearance(),tabAppearance=if(tag=="md-tab") parseLivePreviewTabAppearance(request) else AWCTabAppearance(),navigationBarAppearance=if(tag=="md-navigation-bar") parseLivePreviewNavigationBarAppearance(request) else AWCNavigationBarAppearance(),navigationTabAppearance=if(tag=="md-navigation-tab") parseLivePreviewNavigationTabAppearance(request) else AWCNavigationTabAppearance(),textFieldAppearance=if(tag=="md-text-field") parseLivePreviewTextFieldAppearance(request) else AWCTextFieldAppearance(),selectAppearance=if(tag=="md-select") parseLivePreviewSelectAppearance(request) else AWCSelectAppearance(),multiSelectAppearance=if(tag=="md-multi-select") parseLivePreviewMultiSelectAppearance(request) else AWCMultiSelectAppearance(),numberFieldAppearance=if(tag=="md-number-field") parseLivePreviewNumberFieldAppearance(request) else AWCNumberFieldAppearance(),autocompleteAppearance=if(tag=="md-autocomplete") parseLivePreviewAutocompleteAppearance(request) else AWCAutocompleteAppearance(),otpFieldAppearance=if(tag=="md-otp-field") parseLivePreviewOTPFieldAppearance(request) else AWCOTPFieldAppearance(),menuAppearanceDefaults=if(tag=="md-menu") parseLivePreviewMenuAppearance(request,"menuAppearanceDefaults") else AWCMenuAppearance(),menuAppearance=if(tag=="md-menu") parseLivePreviewMenuAppearance(request,"menuAppearance") else AWCMenuAppearance())
        createSurface(width)
        container.setBackgroundColor(themeTokens["--md-sys-color-surface"]?.let { css -> Color.parseColor(if(css.length==9) "#"+css.takeLast(2)+css.substring(1,7) else css) } ?: if (dark) 0xFF141414.toInt() else Color.WHITE)
    }

    private fun createSurface(width: Double) {
        val nativeSurface = LivePreviewSurface(this, width)
        surface = nativeSurface
        preview = nativeSurface.preview
        container = nativeSurface.container
        preview.viewTreeObserver.addOnPreDrawListener(drawListener)
        preview.setContent {
            configuration?.let { config ->
                val revision=propertyRevision
                androidx.compose.runtime.SideEffect {
                    renderedPropertyRevision=revision
                    // A retained update may change only semantics or timing; draw this frame
                    // anyway so its revision reaches a committed surface and the update ACKs.
                    if(pendingPropertyUpdate?.first?.let { revision>=it }==true) preview.invalidate()
                }
                CompositionLocalProvider(LocalDensity provides Density(previewDensity, 1f), LocalLayoutDirection provides config.direction) {
                    AWCTheme(darkTheme = config.dark, tokenOverrides = config.themeTokens) {
                      AWCFabMenuAppearanceScope(config.fabMenuAppearance) {
                      AWCFabMenuItemAppearanceScope(config.fabMenuItemAppearance) {
                      AWCDividerAppearanceScope(config.dividerAppearance) {
                      AWCBadgeAppearanceScope(config.badgeAppearance) {
                      AWCFabControllerScope(fabController) {
                      AWCFabAppearanceScope(config.fabAppearance) {
                      AWCButtonGroupStateScope(buttonGroupState) {
                      AWCButtonGroupAppearanceScope(config.buttonGroupAppearance) {
                      AWCIconButtonAppearanceScope(config.iconButtonAppearance) {
                        AWCButtonAppearanceScope(config.buttonAppearanceDefaults) {
                            AWCButtonAppearanceScope(config.buttonAppearance) {
                              AWCActionScope(onAction = {}, id = "preview-root", onCapture = {
                                  if (pendingNativeActions.size >= 32) pendingNativeActions.removeFirst()
                                  pendingNativeActions.addLast(it)
                              }) {
                                val previewDotColor = MaterialTheme.colorScheme.primary.copy(alpha=.18f)
                                AWCFabMenuScope {
                                AWCPreviewScope(Modifier.fillMaxWidth().heightIn(min = if(config.tag in setOf("md-snackbar","md-tooltip","md-dialog","md-bottom-sheet","md-side-sheet","md-time-picker","md-color-picker","md-date-picker","md-search")) 0.dp else 100.dp, max = nativeSurface.maxLogicalHeight.dp)
                                    .background(if (config.themeTokens.isEmpty()) androidx.compose.ui.graphics.Color(if (config.dark) 0xFF141414 else 0xFFFFFFFF) else MaterialTheme.colorScheme.surface)
                                    .drawBehind {
                                        val step=24.dp.toPx()
                                        var x=(size.width/2)%step
                                        while(x<size.width) {
                                            var y=(size.height/2)%step
                                            while(y<size.height) {
                                                val center=Offset(x,y)
                                                drawCircle(Brush.radialGradient(
                                                    0f to previewDotColor,.8f to previewDotColor,1f to previewDotColor.copy(alpha=0f),
                                                    center=center,radius=1.dp.toPx()),1.dp.toPx(),center)
                                                y+=step
                                            }
                                            x+=step
                                        }
                                    }) {
                                    Box(Modifier.fillMaxWidth().heightIn(min=if(config.tag in setOf("md-snackbar","md-tooltip","md-dialog","md-bottom-sheet","md-side-sheet","md-time-picker","md-color-picker","md-date-picker","md-search")) 0.dp else 100.dp).padding(if(config.tag in setOf("md-snackbar","md-tooltip","md-dialog","md-bottom-sheet","md-side-sheet","md-time-picker","md-color-picker","md-date-picker","md-search")) 0.dp else 32.dp), contentAlignment = Alignment.Center) {
                                        if (config.scenario == "button-behavior") AWCButtonBehaviorDemo(config.properties, ::recordEvent)
                                        else if (config.scenario == "navigation-events") AWCButtonNavigationDemo(config.properties, ::recordEvent)
                                        else if (config.scenario == "focus-accessibility") AWCButtonAccessibilityDemo(config.properties, ::recordEvent)
                                        else if(config.tag=="md-fab-menu") Box(Modifier.requiredSize(360.dp,480.dp)) {
                                            Box(Modifier.requiredSize(360.dp,480.dp),contentAlignment=Alignment.Center) {
                                                AWCActionTargetScope(id="demo-fab-anchor") {
                                                    AWCComponent("md-fab",mapOf("id" to "demo-fab-anchor","icon" to "add","label" to "Create"),onEvent=::recordEvent)
                                                }
                                            }
                                            AWCFabMenuControllerScope(fabMenuController) {
                                                AWCInspectionScope(inspectionCollector) {
                                                  AWCActionTargetScope(id="component") {
                                                    AWCComponent("md-fab-menu",config.properties,onEvent=::recordEvent) { slot->
                                                        if(slot.isEmpty()) listOf(Triple("document","edit","New document"),Triple("folder","folder","New folder"),Triple("image","photo","Upload image")).forEach { (id,icon,label)->
                                                            AWCActionTargetScope(id="menu-item-$id") {
                                                                AWCComponent("md-fab-menu-item",mapOf("icon" to icon,"label" to label),onEvent=::recordEvent)
                                                            }
                                                        }
                                                    }
                                                  }
                                                }
                                            }
                                        }
                                        else if(config.tag=="md-split-button") AWCSplitButtonAppearanceScope(config.splitButtonAppearance) {
                                            AWCSplitButtonStateScope(splitButtonState) {
                                                AWCInspectionScope(inspectionCollector) {
                                                    AWCActionTargetScope(id="component") {
                                                        AWCComponent(config.tag,config.properties,onEvent=::recordEvent) { slot ->
                                                            LivePreviewSampleSlot(config.tag,slot,config.scenario,config.text,slots=config.slots,onEvent=::recordEvent)
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        else if(config.tag in setOf("md-segmented-button","md-segmented-button-set")) {
                                            AWCSegmentedButtonAppearanceScope(config.segmentedDefaults) {
                                              AWCSegmentedButtonSetStateScope(segmentedState) {
                                                if(config.segmentedContext.mode=="set") AWCActionTargetScope(id="segmented-set") {
                                                  // The canvas listener sits above the set. The set consumes
                                                  // its child proposal; a direct target callback must not leak it.
                                                  val segmentCanvasEvent:(String,AWCValue)->Unit={ event,detail ->
                                                    if(event!="mdSegmentClick") recordEvent(event,detail)
                                                  }
                                                  AWCComponent("md-segmented-button-set",mapOf("multiselect" to config.segmentedContext.multiselect,"density" to config.segmentedContext.density),onEvent=::recordEvent) { name ->
                                                    if(name.isEmpty()) listOf("Day","Week","Month").forEachIndexed { index,label ->
                                                      val props=if(index==0 && config.tag=="md-segmented-button") config.properties else mapOf("label" to label,"value" to label.lowercase())
                                                      AWCActionTargetScope(id="segment-${label.lowercase()}") {
                                                        if(index==0) AWCSegmentedButtonAppearanceScope(config.segmentedAppearance) {
                                                          AWCInspectionScope(inspectionCollector) {
                                                            AWCComponent("md-segmented-button",props+("selected" to config.segmentedContext.selection[index]),onEvent=segmentCanvasEvent) { slot ->
                                                              LivePreviewSampleSlot("md-segmented-button",slot,"",null,slots=config.slots,onEvent=::recordEvent)
                                                            }
                                                          }
                                                        } else AWCComponent("md-segmented-button",props+("selected" to config.segmentedContext.selection[index]),onEvent=segmentCanvasEvent)
                                                      }
                                                    }
                                                  }
                                                } else AWCSegmentedButtonAppearanceScope(config.segmentedAppearance) {
                                                  AWCInspectionScope(inspectionCollector) {
                                                    AWCActionTargetScope(id="segment-day") {
                                                      AWCComponent("md-segmented-button",config.properties,onEvent=::recordEvent) { slot ->
                                                        LivePreviewSampleSlot("md-segmented-button",slot,"",null,slots=config.slots,onEvent=::recordEvent)
                                                      }
                                                    }
                                                  }
                                                }
                                              }
                                            }
                                        }
                                        else if(config.tag=="md-progress-indicator") AWCProgressIndicatorAppearanceScope(config.progressAppearance) {
                                            Box(Modifier.requiredWidth(300.dp),contentAlignment=Alignment.Center) {
                                                AWCInspectionScope(inspectionCollector) { AWCComponent(config.tag,config.properties,onEvent=::recordEvent) }
                                            }
                                        }
                                        // The menu recipe: the trigger and the anchored menu in an AWCMenuScope; the previewed element is inspected.
                                        else if(config.tag in livePreviewMenuTags) LivePreviewMenuHost(config.tag,config.properties,menuState,config.menuAppearanceDefaults,config.menuAppearance,::recordEvent) { element->
                                            AWCInspectionScope(inspectionCollector) { AWCActionTargetScope(id="component") { element() } }
                                        }
                                        // Dialogs and sheets present in the preview's own viewport through the shared modal layer.
                                        else if(config.tag in livePreviewModalTags) LivePreviewModalHost(config.tag,config.width,config.snackbarHeight,config.dialogAppearance,config.bottomSheetAppearance,config.sideSheetAppearance,
                                            dialogController,bottomSheetController,sideSheetController) {
                                            AWCInspectionScope(inspectionCollector) {
                                                AWCActionTargetScope(id="component") {
                                                    AWCComponent(config.tag,config.properties,onEvent=::recordEvent) { slot ->
                                                        LivePreviewSampleSlot(config.tag,slot,config.scenario,config.text,slots=config.slots,onEvent=::recordEvent)
                                                    }
                                                }
                                            }
                                        }
                                        else if(config.tag=="md-snackbar") AWCSnackbarScope(Modifier.requiredSize(config.width.toFloat().dp,config.snackbarHeight.toFloat().dp)) {
                                            Box(Modifier.requiredSize(config.width.toFloat().dp,config.snackbarHeight.toFloat().dp))
                                            AWCSnackbarAppearanceScope(config.snackbarAppearance) {
                                                AWCSnackbarControllerScope(snackbarController) {
                                                    AWCSlotsScope(AWCSlotRegistry(config.slots.mapValues { (_,value)-> { AWCSlotText(value as String) } })) {
                                                        AWCInspectionScope(inspectionCollector) {
                                                            AWCActionTargetScope(id="component") { AWCComponent(config.tag,config.properties,onEvent=::recordEvent) }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        else if(config.tag=="md-tooltip") AWCTooltipScope(Modifier.requiredSize(config.width.toFloat().dp,config.snackbarHeight.toFloat().dp)) {
                                            Box(Modifier.fillMaxSize(),contentAlignment=Alignment.Center) {
                                                AWCTooltipAppearanceScope(config.tooltipAppearance) {
                                                    AWCTooltipControllerScope(tooltipController) {
                                                        val tooltipSlots=mutableMapOf<String,@Composable ()->Unit>("" to {
                                                            AWCComponent("md-button",mapOf("label" to (config.text ?: "Hover or focus me"),"variant" to "tonal"))
                                                        })
                                                        config.slots.forEach { (name,value)->tooltipSlots[name]={ AWCSlotText(value as String) } }
                                                        AWCSlotsScope(AWCSlotRegistry(tooltipSlots)) { AWCInspectionScope(inspectionCollector) {
                                                            AWCActionTargetScope(id="component") {
                                                                AWCComponent(config.tag,config.properties,onEvent=::recordEvent)
                                                            }
                                                        } }
                                                    }
                                                }
                                            }
                                        }
                                        else if(config.tag=="md-skeleton") AWCSkeletonAppearanceScope(config.skeletonAppearance) {
                                            AWCSkeletonSizingContextScope(AWCSkeletonSizingContext(parentHeight=160.0)) {
                                                Box(Modifier.requiredSize(260.dp,160.dp),contentAlignment=Alignment.TopStart) {
                                                    AWCInspectionScope(inspectionCollector) { AWCComponent(config.tag,config.properties) }
                                                }
                                            }
                                        }
                                        else if(config.tag=="md-meter") AWCMeterAppearanceScope(config.meterAppearance) {
                                            Box(Modifier.requiredWidth(300.dp),contentAlignment=Alignment.Center) {
                                                AWCInspectionScope(inspectionCollector) { AWCComponent(config.tag,config.properties) }
                                            }
                                        }
                                        else if(config.tag=="md-loading-indicator") AWCLoadingIndicatorAppearanceScope(config.loadingIndicatorAppearance) {
                                            AWCInspectionScope(inspectionCollector) { AWCComponent(config.tag,config.properties) }
                                        }
                                        else if(config.tag=="md-status-dot") AWCStatusDotAppearanceScope(config.statusDotAppearance) {
                                            val dot: @Composable () -> Unit = {
                                                AWCInspectionScope(inspectionCollector) {
                                                    AWCComponent("md-status-dot",config.properties,onEvent=::recordEvent)
                                                }
                                            }
                                            val parent: @Composable () -> Unit = {
                                                AWCIconButtonAppearanceScope(AWCIconButtonAppearance(width=48.0,height=48.0)) {
                                                    AWCComponent("md-icon-button",mapOf("size" to "md","icon" to "notifications","aria-label" to "Notifications"),onEvent=::recordEvent)
                                                }
                                            }
                                            if(config.properties["inline"]==true) Row(horizontalArrangement=Arrangement.spacedBy(12.dp),verticalAlignment=Alignment.CenterVertically) {
                                                parent();dot()
                                            } else AWCStatusDotHost(Modifier.requiredSize(48.dp,48.dp),dot=dot,content=parent)
                                        }
                                        else if(config.tag=="md-badge") AWCBadgeHost(Modifier.requiredSize(48.dp,48.dp),badge={
                                            AWCInspectionScope(inspectionCollector) {
                                                AWCComponent("md-badge",config.properties,onEvent=::recordEvent) { slot->
                                                    LivePreviewSampleSlot(config.tag,slot,config.scenario,config.text,slots=config.slots,onEvent=::recordEvent)
                                                }
                                            }
                                        }) {
                                            AWCIconButtonAppearanceScope(AWCIconButtonAppearance(width=48.0,height=48.0)) {
                                                AWCComponent("md-icon-button",mapOf("size" to "md","icon" to "notifications","aria-label" to "Notifications"),onEvent=::recordEvent)
                                            }
                                        }
                                        else if(config.tag in setOf("md-accordion","md-accordion-item")) AWCAccordionAppearanceScope(config.accordionAppearance) {
                                            AWCAccordionItemAppearanceScope(config.accordionItemAppearance) {
                                                val accordion: @Composable () -> Unit = {
                                                    AWCAccordionItemControllerScope(accordionItemController) {
                                                        AWCInspectionScope(inspectionCollector) {
                                                            AWCComponent(config.tag,previewSlotProperties(config.tag,config.properties,config.slots),onEvent=::recordEvent) { slot ->
                                                                LivePreviewSampleSlot(config.tag,slot,config.scenario,config.text,slots=config.slots,onEvent=::recordEvent)
                                                            }
                                                        }
                                                    }
                                                }
                                                // A floating accordion leaves the flow: the padded preview area is its viewport.
                                                if(config.tag=="md-accordion") AWCAccordionViewport(Modifier.fillMaxWidth().heightIn(min=if(config.properties["floating"]==true) 320.dp else 0.dp)) { accordion() }
                                                else accordion()
                                            }
                                        }
                                        else if(config.tag in setOf("md-list","md-list-item")) AWCListAppearanceScope(config.listAppearance) {
                                            AWCListItemAppearanceScope(config.listItemAppearance) {
                                                // Controllers attach by the authored id (md-list's renderer keys an unnamed list as "list").
                                                val id=config.properties["id"] as? String ?: ""
                                                AWCListControllerScope(listController,id.ifEmpty { "list" }) {
                                                    AWCListItemControllerScope(listItemController,id) {
                                                        AWCInspectionScope(inspectionCollector) {
                                                            AWCComponent(config.tag,previewSlotProperties(config.tag,config.properties,config.slots),onEvent=::recordEvent) { slot ->
                                                                LivePreviewSampleSlot(config.tag,slot,config.scenario,config.text,slots=config.slots,onEvent=::recordEvent)
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        else if(config.tag in livePreviewNavTags) LivePreviewNavScope(navOptions,navControllers) {
                                            AWCInspectionScope(inspectionCollector) {
                                                AWCComponent(config.tag,previewSlotProperties(config.tag,config.properties,config.slots),onEvent=::recordEvent) { slot ->
                                                    LivePreviewSampleSlot(config.tag,slot,config.scenario,config.text,slots=config.slots,onEvent=::recordEvent)
                                                }
                                            }
                                        }
                                        else if(config.tag in livePreviewChartTags) LivePreviewChartScope(chartOptions,chartController) {
                                            AWCInspectionScope(inspectionCollector) {
                                                AWCComponent(config.tag,previewSlotProperties(config.tag,config.properties,config.slots),onEvent=::recordEvent) { slot ->
                                                    LivePreviewSampleSlot(config.tag,slot,config.scenario,config.text,slots=config.slots,onEvent=::recordEvent)
                                                }
                                            }
                                        }
                                        else if(config.tag in livePreviewTableTags) LivePreviewTableScope(tableOptions,tableController,tablePaginationController) {
                                            AWCInspectionScope(inspectionCollector) {
                                                AWCComponent(config.tag,previewSlotProperties(config.tag,config.properties,config.slots),onEvent=::recordEvent) { slot ->
                                                    LivePreviewSampleSlot(config.tag,slot,config.scenario,config.text,slots=config.slots,onEvent=::recordEvent)
                                                }
                                            }
                                        }
                                        else if(config.tag in livePreviewSRTags) LivePreviewSRScope(srOptions,srRatingController) {
                                            AWCInspectionScope(inspectionCollector) {
                                                AWCComponent(config.tag,previewSlotProperties(config.tag,config.properties,config.slots),onEvent=::recordEvent) { slot ->
                                                    LivePreviewSampleSlot(config.tag,slot,config.scenario,config.text,slots=config.slots,onEvent=::recordEvent)
                                                }
                                            }
                                        }
                                        else if(config.tag in livePreviewStepperTags) LivePreviewStepperScope(stepperOptions,stepperController) {
                                            AWCInspectionScope(inspectionCollector) {
                                                AWCComponent(config.tag,previewSlotProperties(config.tag,config.properties,config.slots),onEvent=::recordEvent) { slot ->
                                                    LivePreviewSampleSlot(config.tag,slot,config.scenario,config.text,slots=config.slots,onEvent=::recordEvent)
                                                }
                                            }
                                        }
                                        else if(config.tag=="md-otp-field") AWCOTPFieldAppearanceScope(config.otpFieldAppearance) {
                                            AWCOTPFieldControllerScope(otpFieldController) { AWCInspectionScope(inspectionCollector) {
                                                AWCComponent(config.tag,previewSlotProperties(config.tag,config.properties,config.slots),onEvent=::recordEvent) { slot ->
                                                    LivePreviewSampleSlot(config.tag,slot,config.scenario,config.text,slots=config.slots,onEvent=::recordEvent)
                                                }
                                            } }
                                        }
                                        // md-autocomplete's suggestions present in the preview's menu layer (anchored below the field).
                                        else if(config.tag=="md-autocomplete") AWCAutocompleteAppearanceScope(config.autocompleteAppearance) {
                                            AWCAutocompleteControllerScope(autocompleteController) { AWCMenuScope(menuState,Modifier.fillMaxWidth().heightIn(min=320.dp)) {
                                                AWCInspectionScope(inspectionCollector) {
                                                    AWCComponent(config.tag,previewSlotProperties(config.tag,config.properties,config.slots),onEvent=::recordEvent) { slot ->
                                                        LivePreviewSampleSlot(config.tag,slot,config.scenario,config.text,slots=config.slots,onEvent=::recordEvent)
                                                    }
                                                }
                                            } }
                                        }
                                        else if(config.tag=="md-number-field") AWCNumberFieldAppearanceScope(config.numberFieldAppearance) {
                                            AWCNumberFieldControllerScope(numberFieldController) { AWCInspectionScope(inspectionCollector) {
                                                AWCComponent(config.tag,previewSlotProperties(config.tag,config.properties,config.slots),onEvent=::recordEvent) { slot ->
                                                    LivePreviewSampleSlot(config.tag,slot,config.scenario,config.text,slots=config.slots,onEvent=::recordEvent)
                                                }
                                            } }
                                        }
                                        else if(config.tag=="md-date-picker") LivePreviewDatePicker(config.width,config.snackbarHeight,datePickerAppearance,datePickerController) {
                                            AWCInspectionScope(inspectionCollector) {
                                                AWCComponent(config.tag,previewSlotProperties(config.tag,config.properties,config.slots),onEvent=::recordEvent) { slot ->
                                                    LivePreviewSampleSlot(config.tag,slot,config.scenario,config.text,slots=config.slots,onEvent=::recordEvent)
                                                }
                                            }
                                        }
                                        else if(config.tag in setOf("md-color-picker","md-time-picker")) LivePreviewPicker(config.tag,config.width,config.snackbarHeight,pickerAppearances,colorPickerController,timePickerController) {
                                            AWCInspectionScope(inspectionCollector) {
                                                AWCComponent(config.tag,previewSlotProperties(config.tag,config.properties,config.slots),onEvent=::recordEvent) { slot ->
                                                    LivePreviewSampleSlot(config.tag,slot,config.scenario,config.text,slots=config.slots,onEvent=::recordEvent)
                                                }
                                            }
                                        }
                                        else if(config.tag in livePreviewSelectTags) AWCSelectAppearanceScope(config.selectAppearance) { AWCMultiSelectAppearanceScope(config.multiSelectAppearance) {
                                            AWCSelectControllerScope(selectController) { AWCMultiSelectControllerScope(multiSelectController) { AWCInspectionScope(inspectionCollector) {
                                                AWCComponent(config.tag,previewSlotProperties(config.tag,config.properties,config.slots),onEvent=::recordEvent) { slot ->
                                                    LivePreviewSampleSlot(config.tag,slot,config.scenario,config.text,slots=config.slots,onEvent=::recordEvent)
                                                }
                                            } } }
                                        } }
                                        else if(config.tag=="md-text-field") AWCTextFieldAppearanceScope(config.textFieldAppearance) {
                                            AWCTextFieldControllerScope(textFieldController) { AWCInspectionScope(inspectionCollector) {
                                                AWCComponent(config.tag,previewSlotProperties(config.tag,config.properties,config.slots),onEvent=::recordEvent) { slot ->
                                                    LivePreviewSampleSlot(config.tag,slot,config.scenario,config.text,slots=config.slots,onEvent=::recordEvent)
                                                }
                                            } }
                                        }
                                        else if(config.tag in setOf("md-navigation-bar","md-navigation-tab")) AWCNavigationBarAppearanceScope(config.navigationBarAppearance) {
                                            AWCNavigationTabAppearanceScope(config.navigationTabAppearance) { AWCNavigationBarControllerScope(navigationBarController) { AWCNavigationTabControllerScope(navigationTabController) { AWCInspectionScope(inspectionCollector) {
                                                AWCComponent(config.tag, previewSlotProperties(config.tag, config.properties, config.slots), onEvent = ::recordEvent) { slot ->
                                                    LivePreviewSampleSlot(config.tag, slot, config.scenario, config.text, slots = config.slots, onEvent = ::recordEvent)
                                                }
                                            } } } }
                                        }
                                        else if(config.tag in setOf("md-tabs","md-tab","md-tab-panels","md-tab-panel")) AWCTabsAppearanceScope(config.tabsAppearance) {
                                            AWCTabAppearanceScope(config.tabAppearance) { AWCTabsControllerScope(tabsController) { AWCInspectionScope(inspectionCollector) {
                                                AWCComponent(config.tag, previewSlotProperties(config.tag, config.properties, config.slots), onEvent = ::recordEvent) { slot ->
                                                    LivePreviewSampleSlot(config.tag, slot, config.scenario, config.text, slots = config.slots, onEvent = ::recordEvent)
                                                }
                                            } } }
                                        }
                                        else if(config.tag in setOf("md-breadcrumbs","md-breadcrumb-item")) AWCBreadcrumbsAppearanceScope(config.breadcrumbsAppearance) {
                                            AWCBreadcrumbsControllerScope(breadcrumbsController) { AWCInspectionScope(inspectionCollector) {
                                                AWCComponent(config.tag, previewSlotProperties(config.tag, config.properties, config.slots), onEvent = ::recordEvent) { slot ->
                                                    // The crumb label is searchable text (mdSelect label, accessible name).
                                                    if(config.tag=="md-breadcrumb-item" && slot.isEmpty()) AWCSlotText((config.slots[""] as? String) ?: config.text ?: "Projects")
                                                    else LivePreviewSampleSlot(config.tag, slot, config.scenario, config.text, slots = config.slots, onEvent = ::recordEvent)
                                                }
                                            } }
                                        }
                                        else if(config.tag=="md-search") AWCSearchAppearanceScope(config.searchAppearance) {
                                            Box(Modifier.requiredSize(config.width.toFloat().dp,config.snackbarHeight.toFloat().dp)) { // searchHostSize
                                            AWCSearchControllerScope(searchController) { AWCInspectionScope(inspectionCollector) {
                                                AWCComponent(config.tag,previewSlotProperties(config.tag,config.properties,config.slots),onEvent=::recordEvent) { slot ->
                                                    LivePreviewSampleSlot(config.tag,slot,config.scenario,config.text,slots=config.slots,onEvent=::recordEvent)
                                                }
                                            } } }
                                        }
                                        else if(config.tag=="md-ripple") AWCRippleAppearanceScope(config.rippleAppearance) {
                                            AWCRippleControllerScope(rippleController) { AWCInspectionScope(inspectionCollector) { AWCRippleExampleSurface(config.properties) } }
                                        }
                                        else if(config.tag in livePreviewSelectionTags) AWCSwitchAppearanceScope(config.switchAppearance) {
                                            AWCCheckboxAppearanceScope(config.checkboxAppearance) { AWCRadioAppearanceScope(config.radioAppearance) { AWCChipAppearanceScope(config.chipAppearance) {
                                                AWCSelectionControlControllerScope(selectionController) { AWCInspectionScope(inspectionCollector) {
                                                    AWCComponent(config.tag,previewSlotProperties(config.tag,config.properties,config.slots),onEvent=::recordEvent) { slot ->
                                                        LivePreviewSampleSlot(config.tag,slot,config.scenario,config.text,slots=config.slots,onEvent=::recordEvent)
                                                    }
                                                } }
                                            } } }
                                        }
                                        else if(config.tag=="md-avatar") AWCAvatarAppearanceScope(config.avatarAppearance) {
                                            AWCInspectionScope(inspectionCollector) {
                                                // The Laboratory recipe has no slotted content: the person icon is the slot's fallback.
                                                AWCComponent(config.tag, previewSlotProperties(config.tag, config.properties, config.slots), onEvent = ::recordEvent)
                                            }
                                        }
                                        else if(config.tag=="md-organization-chart") AWCOrgChartAppearanceScope(config.orgChartAppearance) {
                                            AWCInspectionScope(inspectionCollector) {
                                                AWCComponent(config.tag, previewSlotProperties(config.tag, config.properties, config.slots), onEvent = ::recordEvent) { slot ->
                                                    LivePreviewSampleSlot(config.tag,slot,config.scenario,config.text,slots=config.slots,onEvent=::recordEvent)
                                                }
                                            }
                                        }
                                        else if(config.tag=="md-transfer-list") AWCTransferListAppearanceScope(config.transferListAppearance) {
                                            // The controller attaches by the authored id (an unnamed list is "transfer-list").
                                            AWCTransferListControllerScope(transferListController,(config.properties["id"] as? String ?: "").ifEmpty { "transfer-list" }) {
                                                AWCInspectionScope(inspectionCollector) {
                                                    AWCComponent(config.tag, previewSlotProperties(config.tag, config.properties, config.slots), onEvent = ::recordEvent) { slot ->
                                                        LivePreviewSampleSlot(config.tag,slot,config.scenario,config.text,slots=config.slots,onEvent=::recordEvent)
                                                    }
                                                }
                                            }
                                        }
                                        else if(config.tag=="md-card") AWCCardAppearanceScope(config.cardAppearance) {
                                            AWCInspectionScope(inspectionCollector) {
                                                AWCComponent(config.tag, previewSlotProperties(config.tag, config.properties, config.slots), onEvent = ::recordEvent) { slot ->
                                                    LivePreviewSampleSlot(config.tag, slot, config.scenario, config.text, slots = config.slots, onEvent = ::recordEvent)
                                                }
                                            }
                                        }
                                        else AWCInspectionScope(inspectionCollector) {
                                            if(config.tag=="md-divider") Box(Modifier.requiredSize(300.dp,96.dp),contentAlignment=Alignment.Center) {
                                                AWCComponent(config.tag,config.properties,onEvent=::recordEvent)
                                            } else AWCComponent(config.tag, previewSlotProperties(config.tag, config.properties, config.slots), onEvent = ::recordEvent) { slot ->
                                                LivePreviewSampleSlot(config.tag, slot, config.scenario, config.text, slots = config.slots, buttonGroupSelection=config.buttonGroupSelection, onEvent = ::recordEvent)
                                            }
                                        }
                                    }
                                }
                                }
                              }
                            }
                        }
                      }
                      }
                      }
                      }
                      }
                      }
                      }
                      }
                      }
                    }
                }
            }
        }
    }

    /** Observe actual GPU draws, rather than sampling the same buffer on a timer. */
    private val drawListener = ViewTreeObserver.OnPreDrawListener {
        // PixelCopy must read the exact committed surface whose measurement
        // snapshot we send. Animation state may advance, but a later surface
        // cannot replace that buffer until its short asynchronous copy ends.
        if (captureHoldingDraw) { captureBlockedDraw = true; return@OnPreDrawListener false }
        if (!destroyed.get()) {
            val drawnSequence = ++submittedDraw
            val drawnPropertyRevision=renderedPropertyRevision
            (preview.getChildAt(0) as? androidx.compose.ui.platform.ViewRootForTest)?.let { if (it.hasPendingMeasureOrLayout) it.measureAndLayoutForTest() }
            val drawnInspection = inspectionCollector.snapshot()
            val drawnViewport=preview.width/previewDensity.toDouble() to preview.height/previewDensity.toDouble()
            val drawnSelection = buttonGroupState.snapshot()
            val drawnSegmentedSelection=segmentedState.snapshot()
            val drawnSplitButtonChecked=splitButtonState.snapshot()
            // Register for every draw. A previous commit may arrive after the
            // next pre-draw; gating registration on it silently halves cadence.
            val committed = Runnable {
                val acceptCommit = Runnable {
                    if (!destroyed.get() && drawnSequence > committedDraw) {
                        committedDraw = drawnSequence
                        committedInspection = drawnInspection
                        committedButtonGroupSelection = drawnSelection
                        committedSegmentedSelection=drawnSegmentedSelection
                        committedSplitButtonChecked=drawnSplitButtonChecked
                        firstDraw.complete(Unit)
                        pendingResize?.takeIf { it.first==drawnViewport }?.let {
                            pendingResize=null
                            it.second.complete(Unit)
                        }
                        pendingPropertyUpdate?.takeIf { drawnPropertyRevision>=it.first }?.let {
                            pendingPropertyUpdate=null
                            it.second.complete(Unit)
                        }
                        captureAfterCommit?.takeIf { committedDraw == submittedDraw }?.let { ready ->
                            captureAfterCommit = null
                            ready()
                        }
                        captureStreamFrame()
                    }
                    while (undrawnSubmissions.firstOrNull()?.let { it.first - 1 <= committedDraw } == true) undrawnSubmissions.removeFirst().second.run()
                }
                if (Looper.myLooper() == Looper.getMainLooper()) acceptCommit.run() else main.post(acceptCommit)
            }
            // A layout-only traversal (a View layout whose result invalidated nothing)
            // draws no GPU frame, so a commit callback would wait for some later draw
            // that may never come. The surface keeps the previous submission's pixels:
            // accept this metadata as soon as that previous submission has committed.
            if (!preview.rootView.isDirty && drawnSequence > 1) {
                if (committedDraw >= drawnSequence - 1) main.post(committed)
                else undrawnSubmissions.addLast(drawnSequence to committed)
            }
            else if (Build.VERSION.SDK_INT >= 29 && preview.isHardwareAccelerated) preview.viewTreeObserver.registerFrameCommitCallback(committed)
            // On older Android, posting from onPreDraw still runs after the
            // Choreographer traversal; PixelCopy checks the submitted buffer.
            else main.post(committed)
        }
        true
    }

    private fun requireConfigured(): Configuration = checkNotNull(configuration) { "Configure the native session first." }

    private fun point(request: JSONObject, outside: Boolean = false): Pair<Float, Float> {
        val x = request.optDouble("x", Double.NaN)
        val y = request.optDouble("y", Double.NaN)
        require(x.isFinite() && y.isFinite()) { "Native input requires finite x and y coordinates." }
        val px = x * previewDensity
        val py = y * previewDensity
        if (!outside) require(px >= 0 && py >= 0 && px < preview.width && py < preview.height) { "Input must be inside the logical preview bounds." }
        require(kotlin.math.abs(px) < 100_000 && kotlin.math.abs(py) < 100_000) { "Pointer coordinates exceed the supported range." }
        return px.toFloat() to py.toFloat()
    }

    private fun touch(action: Int, x: Float, y: Float) {
        val now = SystemClock.uptimeMillis()
        if (action == MotionEvent.ACTION_DOWN) downTime = now
        val event = MotionEvent.obtain(downTime, now, action, x, y, 0)
        event.source = InputDevice.SOURCE_TOUCHSCREEN
        try { preview.dispatchTouchEvent(event) } finally { event.recycle() }
    }

    private fun click(request: JSONObject) {
        check(!pointerHeld) { "Release the held native pointer before clicking." }
        val (x, y) = point(request)
        touch(MotionEvent.ACTION_DOWN, x, y)
        touch(MotionEvent.ACTION_UP, x, y)
    }

    private fun pointer(request: JSONObject) {
        val phase = request.optString("phase")
        require(phase in setOf("down", "up", "cancel", "move", "leave")) { "Unsupported native pointer phase." }
        val (x, y) = point(request, outside = phase != "down")
        when (phase) {
            "down" -> {
                if (pointerHeld) return
                pointerHeld = true
                touch(MotionEvent.ACTION_DOWN, x, y)
            }
            "up" -> {
                if (!pointerHeld) return
                pointerHeld = false
                touch(MotionEvent.ACTION_UP, x, y)
            }
            "cancel" -> cancelPointer()
            "move", "leave" -> {
                val actualX = if (phase == "leave") -1000f else x
                val actualY = if (phase == "leave") -1000f else y
                if (pointerHeld) touch(MotionEvent.ACTION_MOVE, actualX, actualY)
                else {
                    val now=SystemClock.uptimeMillis()
                    val pointer=MotionEvent.PointerProperties().apply { id=0;toolType=MotionEvent.TOOL_TYPE_MOUSE }
                    val coordinates=MotionEvent.PointerCoords().apply { this.x=actualX;this.y=actualY }
                    val event=MotionEvent.obtain(now,now,
                        if(phase=="leave") MotionEvent.ACTION_HOVER_EXIT else MotionEvent.ACTION_HOVER_MOVE,
                        1,arrayOf(pointer),arrayOf(coordinates),0,0,1f,1f,0,0,InputDevice.SOURCE_MOUSE,0)
                    try { preview.dispatchGenericMotionEvent(event) } finally { event.recycle() }
                }
            }
        }
    }

    private fun cancelPointer() {
        if (!pointerHeld) return
        pointerHeld = false
        touch(MotionEvent.ACTION_CANCEL, -1000f, -1000f)
    }

    private fun insertText(request: JSONObject): String? {
        require(request.has("text") && request.get("text") is String) { "Text input requires a string." }
        val text = request.getString("text")
        require(text.length <= 4096) { "Text input exceeds 4096 characters." }
        val focused = preview.findFocus() ?: return "No native text editor is focused."
        val connection = focused.onCreateInputConnection(EditorInfo()) ?: return "The focused native control is not a text editor."
        connection.beginBatchEdit()
        try { connection.commitText(text, 1) } finally { connection.endBatchEdit() }
        return null
    }

    private fun key(request: JSONObject): String? {
        val name=request.optString("key")
        val code = keyCodes[name]
        val modifiers = request.optJSONArray("modifiers") ?: JSONArray()
        require(modifiers.length() <= 4) { "Too many key modifiers." }
        var meta = 0
        for (i in 0 until modifiers.length()) meta = meta or when (modifiers.getString(i)) {
            "shift" -> KeyEvent.META_SHIFT_ON
            "control" -> KeyEvent.META_CTRL_ON
            "alt" -> KeyEvent.META_ALT_ON
            "meta" -> KeyEvent.META_META_ON
            else -> throw IllegalArgumentException("Unsupported key modifier.")
        }
        val now = SystemClock.uptimeMillis()
        val target = checkNotNull(surface).window.callback
        if(code!=null) {
            target.dispatchKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_DOWN, code, 0, meta))
            target.dispatchKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_UP, code, 0, meta))
        } else {
            require(name.length==1 && !name[0].isISOControl() && !name[0].isSurrogate()) { "Unsupported native key." }
            val mapped=KeyCharacterMap.load(KeyCharacterMap.VIRTUAL_KEYBOARD).getEvents(name.toCharArray())
                ?: throw IllegalArgumentException("The native keyboard cannot represent this character.")
            val characters=mapped.filter { it.action==KeyEvent.ACTION_DOWN && !KeyEvent.isModifierKey(it.keyCode) }
            require(characters.size==1 && characters.single().unicodeChar==name[0].code) { "The native keyboard cannot represent this character as one key." }
            mapped.forEach { event->
                target.dispatchKeyEvent(KeyEvent(now,now,event.action,event.keyCode,event.repeatCount,event.metaState or meta,
                    event.deviceId,event.scanCode,event.flags,InputDevice.SOURCE_KEYBOARD))
            }
        }
        return null
    }

    private data class Captured(val bitmap: Bitmap, val metadata: JSONObject)

    /** Hold only surface submission during PixelCopy, not animation clocks.
     * A queued GPU frame commits before copying starts; its immutable metadata
     * stays paired with those pixels even if Compose calculates a later layout. */
    private fun capture(stillCurrent: () -> Boolean = { true }, callback: (Result<Captured>) -> Unit) {
        if (captureHoldingDraw) {
            if (queuedCaptures.size >= 8) callback(Result.failure(IllegalStateException("Too many simultaneous native captures.")))
            else queuedCaptures.addLast { capture(stillCurrent,callback) }
            return
        }
        captureHoldingDraw = true
        captureBlockedDraw = false
        val ticket = LivePreviewCaptureTicket(stillCurrent)
        var timeout: Runnable? = null
        val finish: (Result<Captured>) -> Unit = { result ->
            if (!ticket.finish()) result.getOrNull()?.bitmap?.recycle()
            else {
                timeout?.let(main::removeCallbacks)
                captureAfterCommit = null
                captureHoldingDraw = false
                callback(result)
                if (queuedCaptures.isNotEmpty()) main.post(queuedCaptures.removeFirst())
                if (captureBlockedDraw && ::preview.isInitialized && !destroyed.get()) preview.postInvalidateOnAnimation()
            }
        }
        timeout = Runnable { finish(Result.failure(IllegalStateException("Native frame did not commit for capture."))) }
        main.postDelayed(timeout!!,1500)
        val copy = { captureCommitted(ticket,finish) }
        if (committedDraw == submittedDraw && committedDraw > 0) copy()
        else captureAfterCommit = copy
    }

    /** No new draw is submitted until this actual surface copy has completed. */
    private fun captureCommitted(ticket: LivePreviewCaptureTicket, callback: (Result<Captured>) -> Unit) {
        if (destroyed.get()) { callback(Result.failure(IllegalStateException("Preview activity closed."))); return }
        try {
            val captureStarted = SystemClock.elapsedRealtimeNanos()
            val config = requireConfigured()
            val position = IntArray(2)
            preview.getLocationInWindow(position)
            val width = preview.width
            val height = preview.height.coerceAtMost(container.height)
            check(width > 0 && height > 0) { "Native preview has no rendered layout yet." }
            check(width.toLong() * height <= LivePreviewSurface.MAX_PIXELS) { "Native surface exceeds the bounded capture size." }
            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            val rect = Rect(position[0], position[1], position[0] + width, position[1] + height)
            val draw = committedDraw
            val capturedInspection = committedInspection?.takeIf { it.nodes.isNotEmpty() }
            val capturedSplitButtonChecked=committedSplitButtonChecked?.takeIf { config.tag=="md-split-button" && it==splitButtonState.snapshot() }
            val capturedSegmented=committedSegmentedSelection?.takeIf { config.tag in setOf("md-segmented-button","md-segmented-button-set") && it===segmentedState.snapshot() }
            val capturedSelection=committedButtonGroupSelection?.takeIf { config.tag=="md-button-group" && it === buttonGroupState.snapshot() }
            PixelCopy.request(checkNotNull(surface).window, rect, bitmap, { result ->
                ticket.deliver(expired = {
                    bitmap.recycle()
                    callback(Result.failure(IllegalStateException("Native capture was superseded.")))
                }, current = {
                if (destroyed.get()) {
                    bitmap.recycle()
                    callback(Result.failure(IllegalStateException("Native preview was destroyed.")))
                } else if (result == PixelCopy.SUCCESS) {
                    capturedDraw = maxOf(capturedDraw, draw)
                    captureSequence++
                    val now = SystemClock.elapsedRealtimeNanos()
                    callback(Result.success(Captured(bitmap, JSONObject().put("platform", "android").put("renderer", "Jetpack Compose")
                        .put("tag", config.tag).put("width", width).put("height", height)
                        .put("logicalWidth", width / previewDensity.toDouble()).put("logicalHeight", height / previewDensity.toDouble())
                        .put("events", drainEvents()).put("diagnostics", JSONObject()
                            .put("captureSequence", captureSequence).put("surfaceDrawSequence",draw).put("capturedAtMs", now / 1_000_000.0)
                            .put("captureMs", (now - captureStarted) / 1_000_000.0)
                            .put("captureScale", previewDensity.toDouble()).put("droppedCaptures", droppedCaptures))
                        .also { metadata ->
                            if(capturedSplitButtonChecked!=null && capturedSplitButtonChecked==splitButtonState.snapshot() && capturedSplitButtonChecked==committedSplitButtonChecked) metadata.put("splitButtonChecked",capturedSplitButtonChecked)
                            if(capturedSegmented!=null && capturedSegmented===segmentedState.snapshot() && capturedSegmented===committedSegmentedSelection) metadata.put("segmentedSelection",JSONArray(capturedSegmented))
                            if(capturedSelection!=null && capturedSelection===buttonGroupState.snapshot() && capturedSelection===committedButtonGroupSelection) metadata.put("buttonGroupSelection",JSONArray(capturedSelection))
                            // The held surface and this submitted frame's snapshot
                            // remain coherent throughout the asynchronous copy.
                            if(capturedInspection!=null) metadata.put("inspection",serializeLivePreviewInspection(capturedInspection))
                        })))
                } else {
                    bitmap.recycle()
                    callback(Result.failure(IllegalStateException("Native PixelCopy failed with code $result.")))
                }
                })
            }, main)
        } catch (error: Exception) { callback(Result.failure(error)) }
    }

    private fun encode(captured: Captured): JSONObject {
        try {
            val started = SystemClock.elapsedRealtimeNanos()
            val bytes = ByteArrayOutputStream()
            check(captured.bitmap.compress(Bitmap.CompressFormat.PNG, 100, bytes)) { "Native lossless PNG encoding failed." }
            val result = captured.metadata.put("png", Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP))
            val encodeMs = (SystemClock.elapsedRealtimeNanos() - started) / 1_000_000.0
            result.getJSONObject("diagnostics").put("encodeMs", encodeMs)
            if (intent.getBooleanExtra("profile", false)) {
                Log.d("AWCNativePerf", "captureMs=${result.getJSONObject("diagnostics").getDouble("captureMs")} encodeMs=$encodeMs bytes=${bytes.size()}")
            }
            return result
        } finally { captured.bitmap.recycle() }
    }

    private fun frame(): JSONObject {
        val captured = CompletableFuture<Captured>()
        main.post { capture { it.fold(captured::complete, captured::completeExceptionally) } }
        return encode(captured.get(5, TimeUnit.SECONDS)).also { result -> onMain { rememberFrame(result) } }
    }

    private fun rememberFrame(frame: JSONObject) {
        val previous = cachedFrame?.getJSONObject("diagnostics")?.getLong("captureSequence") ?: -1
        if (frame.getJSONObject("diagnostics").getLong("captureSequence") >= previous) {
            cachedFrame = JSONObject(frame, frame.keys().asSequence().toList().toTypedArray()).put("events", JSONArray())
        }
    }

    private fun openStream(writer: LivePreviewServer.Stream) {
        onMain {
            requireConfigured()
            // A browser may reconnect before the old idle socket notices EOF.
            // Both writers passed this token's authentication; replace only its
            // prior writer and force a fresh frame for the new subscriber.
            stopStream()
            stream = writer
            capturedDraw = -1L
            main.post(heartbeat)
            captureStreamFrame()
        }
    }

    // Keep the authenticated stream alive without repeatedly copying or encoding
    // an idle surface. Cached responses deliberately retain captureSequence.
    private val heartbeat = object : Runnable {
        override fun run() {
            val target = stream ?: return
            if (!target.isOpen) { stopStream(); return }
            if (committedDraw <= capturedDraw && !captureInFlight.get() && !encodingInFlight && pendingCapture == null) {
                cachedFrame?.takeIf { it.getJSONObject("diagnostics").getLong("captureSequence") == captureSequence }?.let {
                    val values = drainEvents()
                    if (!target.offer(JSONObject(it, it.keys().asSequence().toList().toTypedArray()).put("kind", "frame").put("events", values))) {
                        for (i in values.length() - 1 downTo 0) events.addFirst(values.getJSONObject(i))
                    }
                }
            }
            main.postDelayed(this, 1000)
        }
    }

    private fun captureStreamFrame() {
        val target = stream ?: return
        if (!target.isOpen) { stopStream(); return }
        if (committedDraw <= capturedDraw || !captureInFlight.compareAndSet(false, true)) return
        capture(stillCurrent = { stream === target && target.isOpen }) { result ->
            captureInFlight.set(false)
            if (result.isFailure) {
                if (stream === target) Log.w("AWCNativeHost", "Native stream capture failed.", result.exceptionOrNull())
                target.fail(result.exceptionOrNull()?.message ?: "Native capture failed.")
                if (stream === target) stopStream()
                else if (stream != null) main.post { captureStreamFrame() }
            } else {
                val captured = result.getOrThrow()
                if (destroyed.get() || stream !== target || !target.isOpen) {
                    captured.bitmap.recycle()
                    restoreEvents(captured)
                } else if (encodingInFlight) {
                    // At most one newest bitmap waits behind the encoder.
                    val previous = pendingCapture?.second
                    if (previous != null) {
                        droppedCaptures++
                        if (!prependEvents(previous, captured)) {
                            previous.bitmap.recycle()
                            captured.bitmap.recycle()
                            pendingCapture = null
                            stopStream(); server?.close(); finish()
                            return@capture
                        }
                        previous.bitmap.recycle()
                    }
                    pendingCapture = target to captured
                } else startEncoding(target, captured)
                // A newer GPU draw may have committed while PixelCopy was busy.
                if (committedDraw > capturedDraw) main.post { captureStreamFrame() }
            }
        }
    }

    private fun startEncoding(target: LivePreviewServer.Stream, captured: Captured) {
        encodingInFlight = true
        val accepted = target.encode {
            var delivered = false
            var encoded: JSONObject? = null
            try {
                if (target.isOpen && !destroyed.get()) {
                    encoded = encode(captured).put("kind", "frame")
                    delivered = target.offer(encoded)
                }
                else captured.bitmap.recycle()
            } catch (error: Exception) {
                Log.w("AWCNativeHost", "Native stream encoding failed.", error)
                target.close()
            } finally {
                main.post {
                    if (stream === target) encoded?.let { rememberFrame(it) }
                    if (!delivered) {
                        val waiting = pendingCapture?.second
                        if (waiting == null) restoreEvents(captured)
                        else if (!prependEvents(captured, waiting)) { stopStream(); server?.close(); finish() }
                    }
                    encodingInFlight = false
                    val next = pendingCapture
                    pendingCapture = null
                    if (next != null) {
                        if (!destroyed.get() && stream === next.first && next.first.isOpen) startEncoding(next.first, next.second)
                        else { next.second.bitmap.recycle(); restoreEvents(next.second) }
                    }
                }
            }
        }
        if (!accepted) {
            encodingInFlight = false
            captured.bitmap.recycle()
            restoreEvents(captured)
            if (stream === target) stopStream()
        }
    }

    private fun prependEvents(earlier: Captured, later: Captured): Boolean {
        val older = earlier.metadata.getJSONArray("events")
        val newer = later.metadata.getJSONArray("events")
        if (older.length() + newer.length() > 256) return false
        val combined = JSONArray()
        for (i in 0 until older.length()) combined.put(older.get(i))
        for (i in 0 until newer.length()) combined.put(newer.get(i))
        later.metadata.put("events", combined)
        return true
    }

    private fun restoreEvents(captured: Captured) {
        if (destroyed.get()) return
        val values = captured.metadata.optJSONArray("events") ?: return
        if (events.size + values.length() > 256) { server?.close(); finish(); return }
        // This bitmap predates callbacks that have since entered the activity queue.
        for (i in values.length() - 1 downTo 0) events.addFirst(values.getJSONObject(i))
        captured.metadata.put("events", JSONArray())
    }

    private fun stopStream() {
        main.removeCallbacks(heartbeat)
        stream?.close()
        stream = null
        pendingCapture?.second?.let { it.bitmap.recycle(); restoreEvents(it) }
        pendingCapture = null
    }

    private fun jsonValue(value: Any?, depth: Int = 0): Any? {
        require(depth <= 16) { "Properties exceed the supported nesting depth." }
        return when (value) {
            null, JSONObject.NULL -> null
            is JSONObject -> value.keys().asSequence().associateWith { jsonValue(value.get(it), depth + 1) }
            is JSONArray -> List(value.length()) { jsonValue(value.get(it), depth + 1) }
            else -> value
        }
    }

    companion object {
        private val keyCodes = mapOf("Enter" to KeyEvent.KEYCODE_ENTER, "Tab" to KeyEvent.KEYCODE_TAB,
            "Backspace" to KeyEvent.KEYCODE_DEL, "Delete" to KeyEvent.KEYCODE_FORWARD_DEL,
            "ArrowLeft" to KeyEvent.KEYCODE_DPAD_LEFT, "ArrowRight" to KeyEvent.KEYCODE_DPAD_RIGHT,
            "ArrowUp" to KeyEvent.KEYCODE_DPAD_UP, "ArrowDown" to KeyEvent.KEYCODE_DPAD_DOWN,
            "Home" to KeyEvent.KEYCODE_MOVE_HOME, "End" to KeyEvent.KEYCODE_MOVE_END,
            "Escape" to KeyEvent.KEYCODE_ESCAPE, "Space" to KeyEvent.KEYCODE_SPACE,
            "PageUp" to KeyEvent.KEYCODE_PAGE_UP, "PageDown" to KeyEvent.KEYCODE_PAGE_DOWN)
    }
}

/** The Node boundary validates requests; malformed optional styling is ignored here defensively. */
internal fun parseLivePreviewButtonAppearance(request: JSONObject, field: String): AWCButtonAppearance {
    val values = request.optJSONObject(field) ?: return AWCButtonAppearance()
    return AWCButtonAppearance.fromValues(values.keys().asSequence().associateWith { values.opt(it) })
}

internal fun parseLivePreviewIconButtonAppearance(request: JSONObject, field: String): AWCIconButtonAppearance {
    val values=request.optJSONObject(field) ?: return AWCIconButtonAppearance()
    return AWCIconButtonAppearance.fromValues(values.keys().asSequence().associateWith { values.opt(it) })
}

internal fun parseLivePreviewBadgeAppearance(request: JSONObject, field: String): AWCBadgeAppearance {
    val values=request.optJSONObject(field) ?: return AWCBadgeAppearance()
    fun native(value:Any?,depth:Int=0):Any?=if(depth>4) null else when(value) {
        null,JSONObject.NULL->null
        is JSONObject->value.keys().asSequence().associateWith { native(value.opt(it),depth+1) }
        is JSONArray->List(value.length()) { native(value.opt(it),depth+1) }
        else->value
    }
    return AWCBadgeAppearance.fromValues(values.keys().asSequence().associateWith { native(values.opt(it)) })
}

internal fun parseLivePreviewStatusDotAppearance(request: JSONObject, field: String): AWCStatusDotAppearance {
    val values=request.optJSONObject(field) ?: return AWCStatusDotAppearance()
    fun native(value:Any?,depth:Int=0):Any?=if(depth>4) null else when(value) {
        null,JSONObject.NULL->null
        is JSONObject->value.keys().asSequence().associateWith { native(value.opt(it),depth+1) }
        else->value
    }
    return AWCStatusDotAppearance.fromValues(values.keys().asSequence().associateWith { native(values.opt(it)) })
}

internal fun parseLivePreviewDividerAppearance(request: JSONObject, field: String): AWCDividerAppearance {
    val values=request.optJSONObject(field) ?: return AWCDividerAppearance()
    return AWCDividerAppearance.fromValues(values.keys().asSequence().associateWith { values.opt(it) })
}

internal fun parseLivePreviewFabAppearance(request: JSONObject, field: String): AWCFabAppearance {
    val values=request.optJSONObject(field) ?: return AWCFabAppearance()
    return AWCFabAppearance.fromValues(values.keys().asSequence().associateWith { values.opt(it) })
}
internal fun parseLivePreviewFabMenuAppearance(request:JSONObject,field:String):AWCFabMenuAppearance {
    val values=request.optJSONObject(field) ?: return AWCFabMenuAppearance()
    return AWCFabMenuAppearance.fromValues(values.keys().asSequence().associateWith { values.opt(it) })
}
internal fun parseLivePreviewFabMenuItemAppearance(request:JSONObject,field:String):AWCFabMenuItemAppearance {
    val values=request.optJSONObject(field) ?: return AWCFabMenuItemAppearance()
    return AWCFabMenuItemAppearance.fromValues(values.keys().asSequence().associateWith { values.opt(it) })
}

internal fun parseLivePreviewButtonGroupAppearance(request: JSONObject, field: String): AWCButtonGroupAppearance {
    val values=request.optJSONObject(field) ?: return AWCButtonGroupAppearance()
    return AWCButtonGroupAppearance.fromValues(values.keys().asSequence().associateWith { values.opt(it) })
}

/** Null means omitted; the empty string intentionally clears the default button label. */
internal fun parseLivePreviewButtonText(request: JSONObject, tag: String): String? {
    if (!request.has("text")) return null
    require(tag == "md-button") { "Preview text is only supported for md-button." }
    val text = request.get("text")
    require(text is String) { "Preview text must be a string." }
    require(text.toByteArray(Charsets.UTF_8).size <= 4096) { "Preview text exceeds 4096 UTF-8 bytes." }
    return text
}

@Composable
internal fun LivePreviewSampleSlot(tag: String, slot: String, scenario: String, text: String?, slots: Map<String, AWCValue> = emptyMap(), buttonGroupSelection: List<Boolean> = listOf(true,false,false), onEvent: (String, AWCValue) -> Unit) {
    LivePreviewNodeOverride.children(tag)?.let { LivePreviewNodeChildren(it, slot, onEvent); return }
    if(tag=="md-button-group" && slot.isEmpty() && scenario.isEmpty()) {
        listOf("Day","Week","Month").forEachIndexed { index,title ->
            // Each child is its own action target (segment-N), so its events keep the child identity.
            AWCActionTargetScope(id="segment-$index") {
                AWCComponent("md-button",mapOf("label" to title,"value" to title.lowercase(),"selected" to buttonGroupSelection[index]),onEvent=onEvent)
            }
        }
    }
    else if(tag in setOf("md-icon-button","md-fab","md-fab-menu-item","md-badge","md-segmented-button","md-split-button") && scenario.isEmpty()) {
        val value=slots[slot]
        if(value is Map<*,*> && value["kind"]=="symbol") AWCMaterialSymbol(value["value"] as String)
        // The editor's Text mode authors a real Web span even when empty.
        // Keep that explicit replacement present; omission alone restores the glyph.
        else if(value is String) AWCSlotText(value)
    }
    else if (tag == "md-button" && scenario.isEmpty() && (slot in slots || slot.isEmpty())) {
        val value = slots[slot]
        if (value is Map<*, *> && value["kind"] == "symbol") AWCMaterialSymbol(value["value"] as String)
        else if (value is Map<*, *> && value["kind"] == "progress") AWCComponent("md-progress-indicator", mapOf("variant" to "circular", "indeterminate" to true, "size" to 24))
        else {
            val part = if (slot.isEmpty()) "label" else slot
            val inspectedText = rememberAWCInspectionText("content.$part.text", family = "Roboto")
            Text(value as? String ?: text ?: "Continue", modifier = inspectedText.modifier, onTextLayout = inspectedText.onTextLayout)
        }
    }
    else if (scenario.isEmpty() && slot in slots) Text(slots.getValue(slot) as String)
    else SampleSlot(tag, slot, onEvent)
}

/** Serializes only measurements reported by the opt-in native collector. */
internal fun serializeLivePreviewInspection(snapshot: AWCInspectionSnapshot): JSONObject {
    fun insets(value: AWCInspectionInsets) = JSONArray(listOf(value.top, value.right, value.bottom, value.left))
    val nodes = JSONArray()
    for (node in snapshot.nodes) {
        val result = JSONObject().put("id", node.id).put("name", node.name)
            .put("bounds", JSONObject().put("x", node.bounds.x).put("y", node.bounds.y).put("width", node.bounds.width).put("height", node.bounds.height))
        node.parentId?.let { result.put("parentId", it) }
        node.metrics?.let { value ->
            val metrics = JSONObject()
            value.padding?.let { metrics.put("padding", insets(it)) }
            value.margin?.let { metrics.put("margin", insets(it)) }
            value.border?.let { metrics.put("border", insets(it)) }
            value.gap?.let { metrics.put("gap", JSONObject().put("row", it.row).put("column", it.column)) }
            value.typography?.let { metrics.put("typography", JSONObject().put("size", it.size).put("lineHeight", it.lineHeight)
                .put("weight", it.weight).put("spacing", it.spacing).put("family", it.family).put("unit", "sp")) }
            value.display?.let { metrics.put("display", it) }
            value.direction?.let { metrics.put("direction", it) }
            result.put("metrics", metrics)
        }
        nodes.put(result)
    }
    return JSONObject().put("version", 1).put("unit", "dp").put("source", "Compose layout").put("nodes", nodes)
}

internal data class LiveSegmentedContext(val mode:String="set",val multiselect:Boolean=false,val density:Int=0,val selection:List<Boolean> = listOf(true,false,false))
internal fun parseLiveSegmentedContext(request:JSONObject,tag:String):LiveSegmentedContext {
    if(!request.has("segmentedContext")) return LiveSegmentedContext()
    require(tag in setOf("md-segmented-button","md-segmented-button-set")) { "Segmented context requires a segmented component." }
    val value=request.getJSONObject("segmentedContext")
    require(value.length()==4 && listOf("mode","multiselect","density","selection").all { value.has(it) }) { "Segmented context requires all four fields." }
    val mode=value.getString("mode")
    require(mode in setOf("standalone","set") && !(tag=="md-segmented-button-set" && mode=="standalone")) { "Invalid segmented mode." }
    require(value.get("multiselect") is Boolean && value.get("density") is Number && value.getDouble("density") in listOf(0.0,-1.0,-2.0,-3.0,-4.0)) { "Invalid segmented parent properties." }
    val states=value.getJSONArray("selection")
    require(states.length()==(if(mode=="set") 3 else 0)) { "Segment selection must match authored children." }
    require((0 until states.length()).all { states.get(it) is Boolean }) { "Segment selection must contain Booleans." }
    return LiveSegmentedContext(mode,value.getBoolean("multiselect"),value.getInt("density"),List(states.length()) { states.getBoolean(it) })
}
internal fun parseLivePreviewSegmentedAppearance(request:JSONObject,field:String):AWCSegmentedButtonAppearance {
    val value=request.optJSONObject(field) ?: return AWCSegmentedButtonAppearance()
    return AWCSegmentedButtonAppearance.fromValues(value.keys().asSequence().associateWith { value.opt(it) })
}

internal fun parseLivePreviewSplitButtonAppearance(request:JSONObject,field:String):AWCSplitButtonAppearance {
    val values=request.optJSONObject(field) ?: return AWCSplitButtonAppearance()
    return AWCSplitButtonAppearance.fromValues(values.keys().asSequence().associateWith { values.opt(it) })
}

internal fun parseLivePreviewLoadingAppearance(request:JSONObject,field:String):AWCLoadingIndicatorAppearance {
    fun value(input:Any?):Any?=when(input) {
        is JSONObject -> input.keys().asSequence().associateWith { value(input.opt(it)) }
        JSONObject.NULL -> null
        else -> input
    }
    val values=request.optJSONObject(field) ?: return AWCLoadingIndicatorAppearance()
    return AWCLoadingIndicatorAppearance.fromValues(values.keys().asSequence().associateWith { value(values.opt(it)) })
}

/** Collector node identity changes on any measurement change, even move-and-return. */
internal fun stableLivePreviewInspection(first:AWCInspectionSnapshot,vararg others:AWCInspectionSnapshot):AWCInspectionSnapshot {
    val indexes=others.map { it.nodes.associateBy { node->node.id } }
    val unchanged=first.nodes.filter { node->indexes.all { it[node.id]===node } }.associateBy { it.id }
    fun connected(node:dev.awc.nativeui.AWCInspectionNode):Boolean=node.parentId?.let { parent->unchanged[parent]?.let(::connected) ?: false } ?: true
    return AWCInspectionSnapshot(first.nodes.filter { unchanged[it.id]===it && connected(it) })
}

internal fun parseLivePreviewMeterAppearance(request:JSONObject,field:String):AWCMeterAppearance {
    fun value(input:Any?):Any?=when(input) {
        is JSONObject -> input.keys().asSequence().associateWith { value(input.opt(it)) }
        JSONObject.NULL -> null
        else -> input
    }
    val values=request.optJSONObject(field) ?: return AWCMeterAppearance()
    return AWCMeterAppearance.fromValues(values.keys().asSequence().associateWith { value(values.opt(it)) })
}

internal fun parseLivePreviewSkeletonAppearance(request:JSONObject,field:String):AWCSkeletonAppearance {
    fun value(input:Any?):Any?=when(input) {
        is JSONObject -> input.keys().asSequence().associateWith { value(input.opt(it)) }
        JSONObject.NULL -> null
        else -> input
    }
    val values=request.optJSONObject(field) ?: return AWCSkeletonAppearance()
    return AWCSkeletonAppearance.fromValues(values.keys().asSequence().associateWith { value(values.opt(it)) })
}
