"use strict";
(() => {
    if (window.welpodron && window.welpodron.templater) {
        if (window.welpodron.mutator) {
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
        class Mutator {
            sessid = "";
            supportedActions = ["load"];
            element = null;
            isLoading = false;
            constructor({ element, sessid, config = {} }) {
                this.setSessid(sessid);
                this.setElement(element);
                document.removeEventListener("click", this.handleDocumentClick);
                document.addEventListener("click", this.handleDocumentClick);
            }
            handleDocumentClick = (event) => {
                let { target } = event;
                if (!target) {
                    return;
                }
                target = target.closest(`[${ATTRIBUTE_BASE_ID}="${this.element?.getAttribute(ATTRIBUTE_BASE_ID)}"][${ATTRIBUTE_CONTROL}][${ATTRIBUTE_ACTION}]`);
                if (!target) {
                    return;
                }
                const action = target.getAttribute(ATTRIBUTE_ACTION);
                const actionArgs = target.getAttribute(ATTRIBUTE_ACTION_ARGS);
                const actionArgsSensitive = target.getAttribute(ATTRIBUTE_ACTION_ARGS_SENSITIVE);
                if (!actionArgs && !actionArgsSensitive) {
                    return;
                }
                const actionFlush = target.getAttribute(ATTRIBUTE_ACTION_FLUSH);
                if (!actionFlush) {
                    event.preventDefault();
                }
                if (!this.supportedActions.includes(action)) {
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
            setSessid = (sessid) => {
                this.sessid = sessid;
            };
            setElement = (element) => {
                this.element = element;
            };
            load = async ({ args, argsSensitive, event, }) => {
                if (this.isLoading) {
                    return;
                }
                this.isLoading = true;
                const controls = document.querySelectorAll(`[${ATTRIBUTE_ACTION_ARGS}="${args}"][${ATTRIBUTE_ACTION}][${ATTRIBUTE_CONTROL}]`);
                controls.forEach((control) => {
                    control.setAttribute("disabled", "");
                });
                const data = new FormData();
                const from = this.element?.getAttribute(ATTRIBUTE_BASE_ID);
                if (from) {
                    data.set("from", from);
                }
                data.set("sessid", this.sessid);
                data.set("args", args);
                data.set("argsSensitive", argsSensitive);
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
                    const response = await fetch("/bitrix/services/main/ajax.php?action=welpodron%3Amutator.Receiver.load", {
                        method: "POST",
                        body: data,
                    });
                    if (!response.ok) {
                        throw new Error(response.statusText);
                    }
                    const bitrixResponse = await response.json();
                    if (bitrixResponse.status === "error") {
                        console.error(bitrixResponse);
                        const error = bitrixResponse.errors[0];
                        window.welpodron.templater.renderHTML({
                            string: error.message,
                            container: this.element,
                            config: {
                                replace: true,
                            },
                        });
                    }
                    else {
                        const { data: responseData } = bitrixResponse;
                        window.welpodron.templater.renderHTML({
                            string: responseData,
                            container: this.element,
                            config: {
                                replace: true,
                            },
                        });
                    }
                }
                catch (error) {
                    console.error(error);
                }
                finally {
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
        window.welpodron.mutator = Mutator;
    }
})();
