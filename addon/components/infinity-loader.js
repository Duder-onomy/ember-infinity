import InViewportMixin from 'ember-in-viewport';
import { run } from '@ember/runloop';
import { get, set } from '@ember/object';
import Component from '@ember/component';
import { inject as service } from '@ember/service';
import { resolve } from 'rsvp';
import ObjectProxy from '@ember/object/proxy';
import PromiseProxyMixin from '@ember/object/promise-proxy-mixin';

const InfinityLoaderComponent = Component.extend(InViewportMixin, {
  infinity: service(),

  classNames: ['infinity-loader'],
  classNameBindings: ['infinityModelContent.reachedInfinity', 'viewportEntered:in-viewport'],
  /**
   * @public
   * @property eventDebounce
   * @default 50
   */
  eventDebounce: 50,
  /**
   * @public
   * @property loadingText
   */
  loadingText: 'Loading Infinite Model...',
  /**
   * @public
   * @property loadedText
   */
  loadedText: 'Infinite Model Entirely Loaded.',
  /**
   * @public
   * @property hideOnInfinity
   * @default false
   */
  hideOnInfinity: false,
  /**
   * @public
   * @property developmentMode
   * @default false
   */
  developmentMode: false,
  /**
   * indicate to infinity-loader to load previous page
   *
   * @public
   * @property loadPrevious
   * @default false
   */
  loadPrevious: false,
  /**
   * set if have scrollable area
   *
   * @public
   * @property scrollable
   */
  scrollable: null,
  /**
   * offset from bottom of target and viewport
   *
   * @public
   * @property triggerOffset
   * @defaul 0
   */
  triggerOffset: 0,
  /**
   * https://emberjs.com/api/ember/3.0/classes/Component/properties/isVisible?anchor=isVisible
   *
   * @property isVisible
   */
  isVisible: true,

  init() {
    this._super(...arguments);

    let scrollableArea = get(this, 'scrollable');
    this.setProperties({
      viewportSpy: true,
      viewportTolerance: {
        top: 0,
        right: 0,
        bottom: get(this, 'triggerOffset'),
        left: 0
      },
      scrollableArea
    });
  },

  willInsertElement() {
    let ObjectPromiseProxy = ObjectProxy.extend(PromiseProxyMixin);
    let proxy = ObjectPromiseProxy.create({
      promise: resolve(get(this, 'infinityModel')),
    });

    set(this, 'infinityModelContent', proxy);
  },

  /**
   * setup ember-in-viewport properties
   *
   * @method didInsertElement
   */
  didInsertElement() {
    this._super(...arguments);

    get(this, 'infinityModelContent')
      .then(() => {
        this._loadStatusDidChange();
        this.addObserver('infinityModelContent.reachedInfinity', this, this._loadStatusDidChange);
        this.addObserver('hideOnInfinity', this, this._loadStatusDidChange);

        let scrollableArea = get(this, 'scrollable');
        let infinityModel = get(this, 'infinityModelContent');
        if (infinityModel) {
          set(infinityModel, '_scrollable', scrollableArea);
        }
      });
  },

  willDestroyElement() {
    this._super(...arguments);
    this._cancelTimers();
    get(this, 'infinityModelContent')
      .then(() => {
        this.removeObserver('infinityModelContent.reachedInfinity', this, this._loadStatusDidChange);
        this.removeObserver('hideOnInfinity', this, this._loadStatusDidChange);
      });
  },

  /**
   * https://github.com/DockYard/ember-in-viewport#didenterviewport-didexitviewport
   *
   * @method didEnterViewport
   */
  didEnterViewport() {
    if (
      get(this, 'developmentMode') ||
      typeof FastBoot !== 'undefined' ||
      this.isDestroying ||
      this.isDestroyed
    ) {
      return false;
    }

    if (get(this, 'loadPrevious')) {
      return this._debounceScrolledToTop();
    }
    return this._debounceScrolledToBottom();
  },

  /**
   * https://github.com/DockYard/ember-in-viewport#didenterviewport-didexitviewport
   *
   * @method didExitViewport
   */
  didExitViewport() {
    this._cancelTimers();
  },

  /**
   * @method loadedStatusDidChange
   */
  _loadStatusDidChange() {
    get(this, 'infinityModelContent')
      .then(() => {
        if (get(this, 'infinityModelContent.reachedInfinity') && get(this, 'hideOnInfinity')) {
          set(this, 'isVisible', false);
        }
      });
  },

  /**
   * only load previous page if route started on a page greater than 1 && currentPage is > 0
   *
   * @method _debounceScrolledToTop
   */
  _debounceScrolledToTop() {
    /*
     This debounce is needed when there is not enough delay between onScrolledToBottom calls.
     Without this debounce, all rows will be rendered causing immense performance problems
     */
    // const infinityModelContent = get(this, 'infinityModelContent');
    get(this, 'infinityModelContent')
      .then((infinityModelContent) => {
        function loadPreviousPage() {
          if (typeof(get(this, 'infinityLoad')) === 'function') {
            // closure action
            return get(this, 'infinityLoad')(infinityModelContent, -1);
          } else {
            get(this, 'infinity').infinityLoad(infinityModelContent, -1)
          }
        }

        if (get(infinityModelContent, 'firstPage') > 1 && get(infinityModelContent, 'currentPage') > 0) {
          this._debounceTimer = run.debounce(this, loadPreviousPage, get(this, 'eventDebounce'));
        }
      });
  },

  /**
   * @method _debounceScrolledToBottom
   */
  _debounceScrolledToBottom() {
    /*
     This debounce is needed when there is not enough delay between onScrolledToBottom calls.
     Without this debounce, all rows will be rendered causing immense performance problems
     */
    get(this, 'infinityModelContent')
      .then(() => {
        function loadMore() {
          // resolve to create thennable
          // type is <InfinityModel|Promise|null>
          let infinityModelContent = resolve(get(this, 'infinityModelContent'));

          infinityModelContent.then((content) => {
            if (typeof(get(this, 'infinityLoad')) === 'function') {
              // closure action (if you need to perform some other logic)
              return get(this, 'infinityLoad')(content);
            } else {
              // service action
              get(this, 'infinity').infinityLoad(content, 1)
                .then(() => {
                  if (get(content, '_canLoadMore')) {
                    this._checkScrollableHeight();
                  }
                });
            }
          });
        }
        this._debounceTimer = run.debounce(this, loadMore, get(this, 'eventDebounce'));
      });
  },

  /**
   * recursive function to fill page with records
   *
   * @method _checkScrollableHeight
   */
  _checkScrollableHeight() {
    if (this._viewportHeight() > this.element.offsetTop) {
      // load again
      this._debounceScrolledToBottom();
    }
  },

  _cancelTimers() {
    run.cancel(this._debounceTimer);
  },

  /**
    calculate the height of the viewport

    @private
    @method _viewportHeight
    @return Integer
   */
  _viewportHeight() {
    if (typeof FastBoot === 'undefined') {
      let isScrollable = !!this.scrollable;
      let viewportElem = isScrollable ? document.querySelector(this.scrollable) : window;
      return isScrollable ? viewportElem.clientHeight : viewportElem.innerHeight;
    }
  }
});

export default InfinityLoaderComponent;
