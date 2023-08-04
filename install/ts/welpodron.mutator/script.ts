(() => {
  if ((window as any).welpodron == null) {
    (window as any).welpodron = {};
  }

  if ((window as any).welpodron.mutator) {
    return;
  }

  type MutatorConfigType = {};

  type MutatorPropsType = {
    element: HTMLElement;
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
    supportedActions = ["load"];

    element: HTMLElement;

    isLoading = false;

    data: FormData;

    constructor({ element, config = {} }: MutatorPropsType) {
      this.element = element;

      this.data = new FormData();

      document.removeEventListener("click", this.handleDocumentClick);
      document.addEventListener("click", this.handleDocumentClick);
    }

    handleDocumentClick = (event: MouseEvent) => {
      let { target } = event;

      if (!target) {
        return;
      }

      target = (target as Element).closest(
        `[data-w-mutator-id="${this.element.getAttribute(
          "data-w-mutator-id"
        )}"][data-w-mutator-action-args][data-w-mutator-action][data-w-mutator-control]`
      );

      if (!target) {
        return;
      }

      const action = (target as Element).getAttribute(
        "data-w-mutator-action"
      ) as keyof this;

      const actionArgs = (target as Element).getAttribute(
        "data-w-mutator-action-args"
      );

      const actionFlush = (target as Element).getAttribute(
        "data-w-mutator-action-flush"
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
          event,
        });
    };

    isStringHTML = (string: string) => {
      const doc = new DOMParser().parseFromString(string, "text/html");
      return [...doc.body.childNodes].some((node) => node.nodeType === 1);
    };

    renderString = ({
      string,
      container,
      config,
    }: {
      string: string;
      container: HTMLElement;
      config: {
        replace?: boolean;
      };
    }) => {
      const replace = config.replace;
      const templateElement = document.createElement("template");
      templateElement.innerHTML = string;
      const fragment = templateElement.content;
      fragment.querySelectorAll("script").forEach((scriptTag) => {
        const scriptParentNode = scriptTag.parentNode;
        scriptParentNode?.removeChild(scriptTag);
        const script = document.createElement("script");
        script.text = scriptTag.text;
        // Новое поведение для скриптов
        if (scriptTag.id) {
          script.id = scriptTag.id;
        }
        scriptParentNode?.append(script);
      });
      if (replace) {
        // омг, фикс для старых браузеров сафари, кринге
        if (!container.replaceChildren) {
          container.innerHTML = "";
          container.appendChild(fragment);
          return;
        }
        return container.replaceChildren(fragment);
      }

      return container.appendChild(fragment);
    };

    load = async ({ args, event }: { args: string | null; event: Event }) => {
      if (event.target === this.element) {
        // бесконечный цикл при вызове через событие instance
        event.preventDefault();
        return;
      }

      if (this.isLoading) return;

      this.isLoading = true;

      this.data = new FormData();

      if (this.element.dataset.mutatorId) {
        this.data.set("from", this.element.dataset.mutatorId);
      }

      if (args) {
        this.data.set("params", args);
      }

      let dispatchedEvent = new CustomEvent("welpodron.mutator:load:before", {
        bubbles: false,
        cancelable: true,
        detail: {
          instance: this,
        },
      });

      if (!this.element.dispatchEvent(dispatchedEvent)) {
        this.isLoading = false;

        let dispatchedEvent = new CustomEvent("welpodron.mutator:load:after", {
          bubbles: false,
          cancelable: false,
          detail: {
            instance: this,
          },
        });

        this.element.dispatchEvent(dispatchedEvent);

        return;
      }

      try {
        const response = await fetch(
          "/bitrix/services/main/ajax.php?action=welpodron%3Amutator.Receiver.load",
          {
            method: "POST",
            body: this.data,
          }
        );

        if (!response.ok) {
          throw new Error(response.statusText);
        }

        const bitrixResponse: _BitrixResponse = await response.json();

        if (bitrixResponse.status === "error") {
          console.error(bitrixResponse);
        } else {
          const { data: responseData } = bitrixResponse;
          if (this.isStringHTML(responseData)) {
            this.renderString({
              string: responseData,
              container: this.element,
              config: {
                replace: true,
              },
            });
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        this.isLoading = false;

        let dispatchedEvent = new CustomEvent("welpodron.mutator:load:after", {
          bubbles: false,
          cancelable: false,
          detail: {
            instance: this,
          },
        });

        this.element.dispatchEvent(dispatchedEvent);
      }
    };
  }

  (window as any).welpodron.mutator = Mutator;
})();
