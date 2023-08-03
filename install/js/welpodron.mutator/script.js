"use strict";
(() => {
    class Mutator {
        supportedActions = ["load"];
        element;
        controls;
        loading = false;
        data;
        constructor({ element, config = {} }) {
            this.element = element;
            this.data = new FormData();
            if (config.controls) {
                this.controls = config.controls;
            }
            else {
                this.controls = [
                    ...document.querySelectorAll(`[data-mutator-action][data-mutator-id="${this.element.dataset.mutatorId}"]`),
                ].filter((element) => element !== this.element);
            }
            this.controls.forEach((control) => {
                control.removeEventListener("click", this.handleControlClick);
                control.addEventListener("click", this.handleControlClick);
            });
        }
        handleControlClick = (event) => {
            event.preventDefault();
            const { currentTarget } = event;
            const action = currentTarget.getAttribute("data-mutator-action");
            const actionArgs = currentTarget.getAttribute("data-mutator-action-args");
            if (!this.supportedActions.includes(action))
                return;
            const actionFunc = this[action];
            if (actionFunc instanceof Function)
                return actionFunc({
                    args: actionArgs,
                    event,
                });
        };
        isStringHTML = (string) => {
            const doc = new DOMParser().parseFromString(string, "text/html");
            return [...doc.body.childNodes].some((node) => node.nodeType === 1);
        };
        renderString = ({ string, container, config, }) => {
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
        load = async ({ args, event }) => {
            if (event.target === this.element) {
                // бесконечный цикл при вызове через событие instance
                event.preventDefault();
                return;
            }
            if (this.loading)
                return;
            this.loading = true;
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
                this.loading = false;
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
                const response = await fetch("/bitrix/services/main/ajax.php?action=welpodron%3Amutator.Receiver.load", {
                    method: "POST",
                    body: this.data,
                });
                if (!response.ok) {
                    throw new Error(response.statusText);
                }
                const bitrixResponse = await response.json();
                if (bitrixResponse.status === "error") {
                    console.error(bitrixResponse);
                }
                else {
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
            }
            catch (error) {
                console.error(error);
            }
            finally {
                this.loading = false;
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
    if (window.welpodron == null) {
        window.welpodron = {};
    }
    window.welpodron.mutator = Mutator;
})();
