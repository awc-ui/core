// Hand-owned Vue adapter. Generated proxies import this through withVueRuntime.
// @ts-nocheck
// It's easier and safer for Volar to disable typechecking and let the return type inference do its job.
import { defineComponent, getCurrentInstance, h, inject, ref, Ref } from 'vue';

export interface InputProps<T> {
  modelValue?: T;
}

const UPDATE_VALUE_EVENT = 'update:modelValue';
const MODEL_VALUE = 'modelValue';
const ROUTER_LINK_VALUE = 'routerLink';
const NAV_MANAGER = 'navManager';
const ROUTER_PROP_PREFIX = 'router';
const ARIA_PROP_PREFIX = 'aria';
/**
 * Starting in Vue 3.1.0, all properties are
 * added as keys to the props object, even if
 * they are not being used. In order to correctly
 * account for both value props and v-model props,
 * we need to check if the key exists for Vue <3.1.0
 * and then check if it is not undefined for Vue >= 3.1.0.
 * See https://github.com/vuejs/vue-next/issues/3889
 */
const EMPTY_PROP = Symbol();
const DEFAULT_EMPTY_PROP = { default: EMPTY_PROP };

interface NavManager<T = any> {
  navigate: (options: T) => void;
}

const getComponentClasses = (classes: unknown) => {
  return (classes as string)?.split(' ') || [];
};

const getElementClasses = (
  ref: Ref<HTMLElement | undefined>,
  componentClasses: Set<string>,
  defaultClasses: string[] = []
) => {
  return [...Array.from(ref.value?.classList || []), ...defaultClasses].filter(
    (c: string, i, self) => !componentClasses.has(c) && self.indexOf(c) === i
  );
};

/**
 * Create a callback to define a Vue component wrapper around a Web Component.
 *
 * @prop name - The component tag name (i.e. `ion-button`)
 * @prop componentProps - An array of properties on the
 * component. These usually match up with the @Prop definitions
 * in each component's TSX file.
 * @prop customElement - An option custom element instance to pass
 * to customElements.define. Only set if `includeImportCustomElements: true` in your config.
 * @prop modelProp - The prop that v-model binds to (i.e. value)
 * @prop modelUpdateEvent - The event that is fired from your Web Component when the value changes (i.e. ionChange)
 */
export const defineContainer = <Props, VModelType = string | number | boolean>(
  name: string,
  defineCustomElement: any,
  componentProps: string[] = [],
  modelProp?: string,
  modelUpdateEvent?: string
) => {
  /**
   * Create a Vue component wrapper around a Web Component.
   * Note: The `props` here are not all properties on a component.
   * They refer to whatever properties are set on an instance of a component.
   */

  if (defineCustomElement !== undefined) {
    defineCustomElement();
  }

  // Stencil includes both props and events in this array. AWC custom events
  // consistently use the mdXxx prefix; ordinary component props do not.
  const eventNames = componentProps.filter((name) => /^md[A-Z]/.test(name));
  const propertyNames = componentProps.filter((name) => !eventNames.includes(name));

  const Container = defineComponent<Props & InputProps<VModelType>>((props, { attrs, slots, emit }) => {
    let modelPropValue = props[modelProp];
    const containerRef = ref<HTMLElement>();
    const classes = new Set(getComponentClasses(attrs.class));

    const currentInstance = getCurrentInstance();
    const hasRouter = currentInstance?.appContext?.provides[NAV_MANAGER];
    const navManager: NavManager | undefined = hasRouter ? inject(NAV_MANAGER) : undefined;
    const handleRouterLink = (ev: Event) => {
      const { routerLink } = props;
      if (routerLink === EMPTY_PROP) return;

      if (navManager !== undefined) {
        /**
         * This prevents the browser from
         * performing a page reload when pressing
         * an Ionic component with routerLink.
         * The page reload interferes with routing
         * and causes ion-back-button to disappear
         * since the local history is wiped on reload.
         */
        ev.preventDefault();

        let navigationPayload: any = { event: ev };
        for (const key in props) {
          const value = props[key];
          if (props.hasOwnProperty(key) && key.startsWith(ROUTER_PROP_PREFIX) && value !== EMPTY_PROP) {
            navigationPayload[key] = value;
          }
        }

        navManager.navigate(navigationPayload);
      } else {
        console.warn('Tried to navigate, but no router was found. Make sure you have mounted Vue Router.');
      }
    };

    return () => {
      modelPropValue = props[modelProp];

      getComponentClasses(attrs.class).forEach((value) => {
        classes.add(value);
      });

      const oldClick = props.onClick;
      const handleClick = (ev: Event) => {
        if (oldClick !== undefined) {
          oldClick(ev);
        }
        if (!ev.defaultPrevented) {
          handleRouterLink(ev);
        }
      };

      let propsToAdd: any = {
        ref: containerRef,
        class: getElementClasses(containerRef, classes),
        onClick: handleClick,
      };

      /**
       * We can use Object.entries here
       * to avoid the hasOwnProperty check,
       * but that would require 2 iterations
       * where as this only requires 1.
       */
      for (const key in props) {
        const value = props[key];
        if ((props.hasOwnProperty(key) && value !== EMPTY_PROP) || key.startsWith(ARIA_PROP_PREFIX)) {
          propsToAdd[key] = value;
        }
      }

      if (modelProp) {
        /**
         * If form value property was set using v-model
         * then we should use that value.
         * Otherwise, check to see if form value property
         * was set as a static value (i.e. no v-model).
         */
        if (props[MODEL_VALUE] !== EMPTY_PROP) {
          propsToAdd = {
            ...propsToAdd,
            ...(name === 'md-radio'
              ? { checked: props[MODEL_VALUE] != null && Object.is(props[MODEL_VALUE], props.value) }
              : { [modelProp]: props[MODEL_VALUE] }),
          };
        } else if (modelPropValue !== EMPTY_PROP) {
          propsToAdd = {
            ...propsToAdd,
            [modelProp]: modelPropValue,
          };
        }
      }

      // If router link is defined, add href to props
      // in order to properly render an anchor tag inside
      // of components that should become activatable and
      // focusable with router link.
      if (props[ROUTER_LINK_VALUE] !== EMPTY_PROP) {
        propsToAdd = {
          ...propsToAdd,
          href: props[ROUTER_LINK_VALUE],
        };
      }

      for (const eventName of eventNames) {
        // Vue's onMdInput DOM fallback listens for md-input. The on: prefix
        // preserves the actual case-sensitive CustomEvent name instead.
        propsToAdd[`on:${eventName}`] = (event: Event) => {
          if (modelProp && eventName === modelUpdateEvent && event.target === event.currentTarget && (name !== 'md-radio' || (event.target as any).checked)) {
            emit(UPDATE_VALUE_EVENT, (event.target as any)[modelProp]);
          }
          emit(eventName, event);
        };
      }
      return h(name, propsToAdd, slots.default && slots.default());
    };
  });

  if (typeof Container !== 'function') {
    Container.name = name;

    Container.props = {
      [ROUTER_LINK_VALUE]: DEFAULT_EMPTY_PROP,
    };

    propertyNames.forEach((componentProp) => {
      Container.props[componentProp] = DEFAULT_EMPTY_PROP;
    });

    Container.emits = [...eventNames, ...(modelProp ? [UPDATE_VALUE_EVENT] : [])];

    if (modelProp) {
      Container.props[MODEL_VALUE] = DEFAULT_EMPTY_PROP;

    }
  }

  return Container;
};
