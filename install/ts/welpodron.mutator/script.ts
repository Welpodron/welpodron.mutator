(() => {
  if ((window as any).welpodron && (window as any).welpodron.templater) {
    if ((window as any).welpodron.mutator) {
      return;
    }

    const MODULE_BASE = "mutator";

    const EVENT_LOAD_BEFORE = `welpodron.${MODULE_BASE}:load:before`;
    const EVENT_LOAD_AFTER = `welpodron.${MODULE_BASE}:load:after`;

    const ATTRIBUTE_BASE = `data-w-${MODULE_BASE}`;
    const ATTRIBUTE_BASE_ID = `${ATTRIBUTE_BASE}-id`;
    const ATTRIBUTE_CONTROL = `${ATTRIBUTE_BASE}-control`;
    const ATTRIBUTE_ACTION = `${ATTRIBUTE_BASE}-action`;
    const ATTRIBUTE_ACTION_ARGS = `${ATTRIBUTE_ACTION}-args`;
    const ATTRIBUTE_ACTION_ARGS_SENSITIVE = `${ATTRIBUTE_ACTION_ARGS}-sensitive`;
    const ATTRIBUTE_ACTION_FLUSH = `${ATTRIBUTE_ACTION}-flush`;

    type MutatorConfigType = {};

    type MutatorPropsType = {
      element: HTMLElement;
      sessid: string;
      config?: MutatorConfigType;
    };

    type _BitrixResponse = {
      data: any;
      status: "success" | "error";
      errors: {
        code: string;
        message: string;
        customData: string;
      }[];
    };

    class Mutator {
      sessid = "";

      supportedActions = ["load"];

      element: HTMLElement | null = null;

      isLoading = false;

      constructor({ element, sessid, config = {} }: MutatorPropsType) {
        this.setSessid(sessid);
        this.setElement(element);

        document.removeEventListener("click", this.handleDocumentClick);
        document.addEventListener("click", this.handleDocumentClick);
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

        const actionArgs = (target as Element).getAttribute(
          ATTRIBUTE_ACTION_ARGS
        );

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

        const actionFunc = this[action] as any;

        if (actionFunc instanceof Function)
          return actionFunc({
            args: actionArgs,
            argsSensitive: actionArgsSensitive,
            event,
          });
      };

      setSessid = (sessid: string) => {
        this.sessid = sessid;
      };

      setElement = (element: HTMLElement) => {
        this.element = element;
      };

      load = async ({
        args,
        argsSensitive,
        event,
      }: {
        args: string | null;
        argsSensitive: string | null;
        event: Event;
      }) => {
        if (this.isLoading) {
          return;
        }

        this.isLoading = true;

        const controls = document.querySelectorAll(
          `[${ATTRIBUTE_ACTION_ARGS}="${args}"][${ATTRIBUTE_ACTION}][${ATTRIBUTE_CONTROL}]`
        );

        controls.forEach((control) => {
          control.setAttribute("disabled", "");
        });

        const data = new FormData();

        const from = this.element?.getAttribute(ATTRIBUTE_BASE_ID);

        if (from) {
          data.set("from", from);
        }

        data.set("sessid", this.sessid);
        data.set("args", args as any);
        data.set("argsSensitive", argsSensitive as any);

        let dispatchedEvent = new CustomEvent(EVENT_LOAD_BEFORE, {
          bubbles: true,
          cancelable: true,
        });

        if (!this.element?.dispatchEvent(dispatchedEvent)) {
          controls.forEach((control) => {
            control.removeAttribute("disabled");
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
          const response = await fetch(
            "/bitrix/services/main/ajax.php?action=welpodron%3Amutator.Receiver.load",
            {
              method: "POST",
              body: data,
            }
          );

          if (!response.ok) {
            throw new Error(response.statusText);
          }

          const bitrixResponse: _BitrixResponse = await response.json();

          if (bitrixResponse.status === "error") {
            console.error(bitrixResponse);

            const error = bitrixResponse.errors[0];

            (window as any).welpodron.templater.renderHTML({
              string: error.message,
              container: this.element as HTMLElement,
              config: {
                replace: true,
              },
            });
          } else {
            const { data: responseData } = bitrixResponse;

            (window as any).welpodron.templater.renderHTML({
              string: responseData,
              container: this.element as HTMLElement,
              config: {
                replace: true,
              },
            });
          }
        } catch (error) {
          console.error(error);
        } finally {
          controls.forEach((control) => {
            control.removeAttribute("disabled");
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

    (window as any).welpodron.mutator = Mutator;
  }
})();
