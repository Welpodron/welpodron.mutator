import { templater } from 'welpodron.core';

const MODULE_BASE = 'mutator';

const CONTROLLER_LOAD_URL =
  '/bitrix/services/main/ajax.php?action=welpodron%3Amutator.Receiver.load';

const EVENT_LOAD_BEFORE = `welpodron.${MODULE_BASE}:load:before`;
const EVENT_LOAD_AFTER = `welpodron.${MODULE_BASE}:load:after`;

const ATTRIBUTE_BASE = `data-w-${MODULE_BASE}`;
const ATTRIBUTE_BASE_ID = `${ATTRIBUTE_BASE}-id`;
const ATTRIBUTE_BASE_ONCE = `${ATTRIBUTE_BASE}-once`;
const ATTRIBUTE_BASE_APPEND = `${ATTRIBUTE_BASE}-append`;
const ATTRIBUTE_CONTROL = `${ATTRIBUTE_BASE}-control`;
const ATTRIBUTE_ACTION = `${ATTRIBUTE_BASE}-action`;
const ATTRIBUTE_ACTION_ARGS = `${ATTRIBUTE_ACTION}-args`;
const ATTRIBUTE_ACTION_ARGS_SENSITIVE = `${ATTRIBUTE_ACTION_ARGS}-sensitive`;
const ATTRIBUTE_ACTION_FLUSH = `${ATTRIBUTE_ACTION}-flush`;

type MutatorConfigType = {
  isOnce?: boolean;
  isAppend?: boolean;
};

type MutatorPropsType = {
  element: HTMLElement;
  sessid: string;
  config?: MutatorConfigType;
};

type _BitrixResponseType = {
  data: string;
  status: 'success' | 'error';
  errors: {
    code: string;
    message: string;
    customData: string;
  }[];
};

class Mutator {
  sessid = '';

  supportedActions = ['load'];

  element: HTMLElement | null = null;

  isLoading = false;
  isOnce = false;
  isAppend = false;
  isLoaded = false;

  constructor({ element, sessid, config = {} }: MutatorPropsType) {
    this.sessid = sessid;
    this.element = element;

    if (config.isOnce != null) {
      this.isOnce = config.isOnce;
    } else {
      this.isOnce = this.element.getAttribute(ATTRIBUTE_BASE_ONCE) != null;
    }

    if (config.isAppend != null) {
      this.isAppend = config.isAppend;
    } else {
      this.isAppend = this.element.getAttribute(ATTRIBUTE_BASE_APPEND) != null;
    }

    document.removeEventListener('click', this.handleDocumentClick);
    document.addEventListener('click', this.handleDocumentClick);
  }

  handleDocumentClick = (event: MouseEvent) => {
    let { target } = event;

    if (!target) {
      return;
    }

    target = (target as Element).closest(
      `[${ATTRIBUTE_BASE_ID}="${this.element?.getAttribute(
        ATTRIBUTE_BASE_ID
      )}"][${ATTRIBUTE_CONTROL}][${ATTRIBUTE_ACTION}]`
    );

    if (!target) {
      return;
    }

    const action = (target as Element).getAttribute(
      ATTRIBUTE_ACTION
    ) as keyof this;

    const actionArgs = (target as Element).getAttribute(ATTRIBUTE_ACTION_ARGS);

    const actionArgsSensitive = (target as Element).getAttribute(
      ATTRIBUTE_ACTION_ARGS_SENSITIVE
    );

    if (!actionArgs && !actionArgsSensitive) {
      return;
    }

    const actionFlush = (target as Element).getAttribute(
      ATTRIBUTE_ACTION_FLUSH
    );

    if (!actionFlush) {
      event.preventDefault();
    }

    if (!this.supportedActions.includes(action as string)) {
      return;
    }

    const actionFunc = this[action];

    if (actionFunc instanceof Function)
      return actionFunc({
        args: actionArgs,
        argsSensitive: actionArgsSensitive,
        event,
      });
  };

  load = async ({
    args,
    argsSensitive,
  }: {
    args: string | null;
    argsSensitive: string | null;
    event: Event;
  }) => {
    if (this.isOnce && this.isLoaded) {
      return;
    }

    if (this.isLoading) {
      return;
    }

    this.isLoaded = false;

    this.isLoading = true;

    const controls = document.querySelectorAll(
      `[${ATTRIBUTE_ACTION_ARGS}="${args}"][${ATTRIBUTE_ACTION}][${ATTRIBUTE_CONTROL}]`
    );

    controls.forEach((control) => {
      control.setAttribute('disabled', '');
    });

    const data = new FormData();

    const from = this.element?.getAttribute(ATTRIBUTE_BASE_ID);

    if (from) {
      data.set('from', from);
    }

    // composite and deep cache fix
    if ((window as any).BX && (window as any).BX.bitrix_sessid) {
      this.sessid = (window as any).BX.bitrix_sessid();
    }

    data.set('sessid', this.sessid);

    if (args) {
      let json = '';

      try {
        JSON.parse(args);
        json = args;
      } catch (_) {
        json = JSON.stringify(args);
      }

      data.set('args', json);
    }

    if (argsSensitive) {
      data.set('argsSensitive', argsSensitive);
    }

    let dispatchedEvent = new CustomEvent(EVENT_LOAD_BEFORE, {
      bubbles: true,
      cancelable: true,
    });

    if (!this.element?.dispatchEvent(dispatchedEvent)) {
      controls.forEach((control) => {
        control.removeAttribute('disabled');
      });

      dispatchedEvent = new CustomEvent(EVENT_LOAD_AFTER, {
        bubbles: true,
        cancelable: false,
      });

      this.element?.dispatchEvent(dispatchedEvent);

      this.isLoading = false;

      return;
    }

    try {
      const response = await fetch(CONTROLLER_LOAD_URL, {
        method: 'POST',
        body: data,
      });

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      const bitrixResponse: _BitrixResponseType = await response.json();

      if (bitrixResponse.status === 'error') {
        console.error(bitrixResponse);

        const error = bitrixResponse.errors[0];

        templater.renderHTML({
          string: error.message,
          container: this.element as HTMLElement,
          config: {
            replace: this.isAppend ? false : true,
          },
        });
      } else {
        const { data: responseData } = bitrixResponse;

        templater.renderHTML({
          string: responseData,
          container: this.element as HTMLElement,
          config: {
            replace: this.isAppend ? false : true,
          },
        });

        if (this.isOnce) {
          document.removeEventListener('click', this.handleDocumentClick);
        }

        this.isLoaded = true;
      }
    } catch (error) {
      console.error(error);
    } finally {
      controls.forEach((control) => {
        control.removeAttribute('disabled');
      });

      dispatchedEvent = new CustomEvent(EVENT_LOAD_AFTER, {
        bubbles: true,
        cancelable: false,
      });

      this.element.dispatchEvent(dispatchedEvent);

      this.isLoading = false;
    }
  };
}

export { Mutator as mutator, MutatorPropsType, MutatorConfigType };
