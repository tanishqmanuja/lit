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

import {LazyElement, html, LazyImport, action} from '../lazy-element.js';
import {Controller} from './test-lazy-controller.js';
import {property} from 'lit-element/decorators/property.js';
import {query} from 'lit-element/decorators/query.js';
import {customElement} from 'lit-element/decorators/custom-element.js';

@customElement('test-lazy-element')
export class TestLazyElement extends LazyElement<Controller> {
  @property() foo = 'initial';

  @query('div') div!: HTMLDivElement;

  static dependencies() {
    return import('./test-lazy-controller.js') as LazyImport;
  }

  render() {
    // prettier-ignore
    return html`<div @click=${action((e: Event) => this.lazyController!.clickHandler(e))}>${this.foo}</div>`;
  }
}