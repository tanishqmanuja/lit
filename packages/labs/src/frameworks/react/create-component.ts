/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import * as ReactModule from 'react';

const reservedReactProperties = new Set([
  'children',
  'localName',
  'ref',
  // TODO(sorvell): why are the properties below included?
  'style',
  'className',
]);

const listenedEvents: WeakMap<
  Element,
  Map<string, EventListenerObject>
> = new WeakMap();

const setEvent = (
  node: Element,
  event: string,
  value: (event?: Event) => void
) => {
  let events = listenedEvents.get(node);
  if (events === undefined) {
    listenedEvents.set(node, (events = new Map()));
  }
  let handler = events.get(event);
  if (value !== undefined) {
    // If necessary, add listener and track handler
    if (handler === undefined) {
      events.set(event, (handler = {handleEvent: value}));
      node.addEventListener(event, handler);
      // Otherwise just update the listener with new value
    } else {
      handler.handleEvent = value;
    }
    // Remove listener if one exists and value is undefined
  } else if (handler !== undefined) {
    events.delete(event);
    node.removeEventListener(event, handler);
  }
};

const setProperty = <E extends Element, T>(
  node: E,
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any,
  old: unknown,
  events?: T
) => {
  // Dirty check and prevent setting reserved properties.
  if (value === old || reservedReactProperties.has(name)) {
    return;
  }
  // For events, use an explicit list.
  const event = (events?.[name as keyof T] as unknown) as string;
  if (event !== undefined) {
    setEvent(node, event, value as (e?: Event) => void);
  } else {
    node[name as keyof E] = value;
  }
};

// Set a React ref. Note, there are 2 kinds of refs and there's no built in
// React API to set a ref.
const setRef = (ref: React.Ref<unknown>, value: Element | null) => {
  if (typeof ref === 'function') {
    (ref as (e: Element | null) => void)(value);
  } else {
    (ref as {current: Element | null}).current = value;
  }
};

type Events<S> = {
  [P in keyof S]?: (e: Event) => unknown;
};

type Constructor<T> = {new (): T};

/**
 *  Creates a React component from a CustomElement.
 */
export const createComponent = <I extends HTMLElement, E>(
  React: typeof ReactModule,
  tagName: string,
  elementClass: Constructor<I>,
  events?: E
) => {
  const Component = React.Component;
  const createElement = React.createElement;

  // Props the user is allowed to use, includes standard attributes, children,
  // ref, as well as special event and element properties.
  type UserProps = React.PropsWithChildren<
    React.PropsWithRef<Partial<I> & Events<E>>
  >;

  // Props used by this component wrapper. This is the UserProps and the
  // special `__forwardedRef` property. Note, this ref is special because
  // it's both needed in this component to get access to the rendered element
  // and must fulfill any ref passed by the user.
  type ComponentProps = UserProps & {
    __forwardedRef?: React.Ref<unknown>;
  };

  // List of properties/events which should be specially handled by the wrapper
  // and not handled directly by React.
  const elementPropsMap: {[index: string]: unknown} = {...(events ?? {})};
  for (const p in elementClass.prototype) {
    if (!(p in HTMLElement.prototype)) {
      elementPropsMap[p] = true;
    }
  }

  class ReactComponent extends Component<ComponentProps> {
    private _element: I | null = null;
    private _elementProps!: typeof elementPropsMap;
    private _userRef?: React.Ref<unknown>;
    private _ref?: (element: I | null) => void;

    private _updateElement(oldProps?: ComponentProps) {
      if (this._element === null) {
        return;
      }
      // Set element properties to the values in `this.props`
      for (const prop in this._elementProps) {
        setProperty(
          this._element,
          prop,
          this.props[prop as keyof ComponentProps],
          oldProps ? oldProps[prop as keyof ComponentProps] : undefined,
          events
        );
      }
      // Note, the spirit of React might be to "unset" any old values that
      // are no longer included; however, there's no reasonable value to set
      // them to so we just leave the previous state as is.
    }

    /**
     * Updates element properties correctly setting properties
     * on mount.
     */
    componentDidMount() {
      this._updateElement();
    }

    /**
     * Updates element properties correctly setting properties
     * on every update. Note, this does not include mount.
     */
    componentDidUpdate(old: ComponentProps) {
      this._updateElement(old);
    }

    /**
     * Renders the custom element with a `ref` prop which allows this
     * component to reference the custom element.
     *
     * Standard attributes are passed to React and element properties and events
     * are updated in componentDidMount/componentDidUpdate.
     *
     */
    render() {
      // Since refs only get fulfilled once, pass a new one if the user's
      // ref changed. This allows refs to be fulfilled as expected, going from
      // having a value to null.
      const userRef = this.props.__forwardedRef as React.Ref<unknown>;
      if (this._ref === undefined || this._userRef !== userRef) {
        this._ref = (value: I | null) => {
          if (this._element === null) {
            this._element = value;
          }
          if (userRef !== null) {
            setRef(userRef, value);
          }
          this._userRef = userRef;
        };
      }
      // Filters class properties out and passes the remaining
      // attributes to React. This allows attributes to use framework rules
      // for setting attributes and render correctly under SSR.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const props: any = {ref: this._ref};
      // Note, save element props while iterating to avoid the need to
      // iterate again when setting properties.
      this._elementProps = {};
      for (const [k, v] of Object.entries(this.props)) {
        if (elementPropsMap[k]) {
          this._elementProps[k] = v;
        } else {
          props[k] = v;
        }
      }
      return createElement(tagName, props, props.children);
    }
  }

  return React.forwardRef((props?: UserProps, ref?: React.Ref<unknown>) =>
    createElement(
      ReactComponent,
      {...props, __forwardedRef: ref} as ComponentProps,
      props?.children
    )
  );
};
