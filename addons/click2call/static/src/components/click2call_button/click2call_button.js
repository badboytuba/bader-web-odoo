/** @odoo-module */

import { PhoneField } from "@web/views/fields/phone/phone_field";
import { patch } from "@web/core/utils/patch";
import { session } from "@web/session";
import { useService } from "@web/core/utils/hooks";
import { _t } from 'web.core';

patch(PhoneField.prototype, "click2call.PhoneField", {
    setup() {
        this._super();
        this.notification = useService("notification");
    },
    /**
     * Called when the phone number is clicked.
     *
     * @private
     * @param {MouseEvent} ev
     */
    async onClick2Call(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (!session.click2call_url) {
            this.notification.add(
                _t('Click2call API URL not found. please configure it from general setting menu'),
                {type: "danger"}
            );
            return;
        }
        if (!session.premium_extension) {
            this.notification.add(
                _t('Premium Extension not set on current login user. please set it from user form view'),
                {type: "danger"}
            );
            return;
        }
        let url = new URL(session.click2call_url);
        var value = this.props.record.data[this.props.name]
        url.searchParams.set('user_id', session.premium_extension);
        url.searchParams.set('remoto', value);
        fetch(url.href).then(function (response) {
            return response.json();
        })
        .then(function (myJson) {
            console.log(myJson);
        })
        .catch(function (error) {
            console.log("Error: " + error);
        });
    },
});

