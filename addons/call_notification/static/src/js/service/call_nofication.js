/** @odoo-module **/

import { registry } from "@web/core/registry";

export const callNotificationService = {
    dependencies: ["bus_service", "notification", "action", "rpc"],

    start(env, { bus_service, notification, action, rpc}) {
        bus_service.addEventListener('notification', ({ detail: notifications }) => {
            for (const { payload, type } of notifications) {
                if (type === 'call_notification') {
                    _onNotification(payload);
                }
            }
        });
        bus_service.start();
        function _onNotification (payload) {
            if (payload.type === 'show') {
                open_popup(payload);
            }
            if (payload.type === 'hide') {
                action.doAction({ type: "ir.actions.act_window_close" })
            }
        }
        function open_popup (data) {
            rpc('web/dataset/call_kw/call.register/show_popup', {
                model: 'call.register',
                method: 'show_popup',
                args: [[]],
                kwargs: data,
            }).then(function (actionData) {
                action.doAction(actionData)
            });
        }
    }
};

registry.category("services").add("callNotification", callNotificationService);
