import { BrazeConfigV2, BrazeParams } from '../types/Braze';
import * as BrazeBaseService from './BrazeBaseService';
import { logToHadoopMessage } from './BrazeBaseService';
import { locationSearch } from '../../common/utils/window';
import { getParameterByName } from '../../common/utils/queryStringUtils';

const config: BrazeConfigV2 = {
    safariWebsitePushId: 'web.com.agoda.www',
    serviceWorkerLocation: '/service-worker.js',
    enableHtmlInAppmessages: true,
    doNotLoadFontAwesome: true,
    enableLogging: true,
};


export const sendEvent = async (uuid: string, params: BrazeParams) => {
    const appboy = await import(/* webpackChunkName: "braze_v2" */'appboy-web-sdk-v2');


        appboy.setLogger((message: string) => {
            const isDebugBrazeEnabled = getParameterByName('debugBraze', locationSearch()) === 'true';
            if (isDebugBrazeEnabled) {
                console.log(message);
            }
            if (message.includes('SDK Error')) {
                logToHadoopMessage(
                    uuid,
                    'Log SDK Error event',
                    'Error',
                    'Error',
                    {
                        errorMessage: message,
                    },
                );
            }
        });
        const isInitializeBrazeSuccess = appboy.initialize(BrazeBaseService.brazeApiKey, config);
        const subscribeStatus = appboy.subscribeToInAppMessage((inAppMessage: any) => handleInAppMessage(appboy, uuid, inAppMessage));
        const brazeUserId = global.memberId;
        appboy.changeUser(brazeUserId);
        appboy.openSession();
        const { pageTypeId, origin, languageId, isLive, cid, trafficGroupId, trafficSubGroupId, currencyCode } = global.trafficData;
        const eventData = params ? BrazeBaseService.mapParams(params) : {
            web_pagetypeid: pageTypeId,
            _country: origin,
            web_langid: languageId,
            web_is_live: isLive,
            device_type: global.deviceType,
            web_cid: cid,
            web_traffic_group: trafficGroupId,
            web_traffic_sub_group: trafficSubGroupId,
            web_currencycode: currencyCode,
        };
        logToHadoopMessage(
            uuid,
            'change_user',
            isInitializeBrazeSuccess ? 'success' : 'failed',
            isInitializeBrazeSuccess ? 'info' : 'fatal',
            { ...eventData, brazeUserId, subscribeStatus },
        );
        const isLogCustomSuccess = appboy.logCustomEvent(BrazeBaseService.getEventName(), {
            ...eventData,
            braze_v2_event: true,
        });
        logToHadoopMessage(
            uuid,
            'log_custom_event_status',
            isLogCustomSuccess ? 'success' : 'failed',
            isLogCustomSuccess ? 'info' : 'fatal',
            { ...eventData, brazeUserId },
        );
};

const handleInAppMessage = (appboy: any, uuid: string, inAppMessages: any) => {
    if (inAppMessages) {
        let msgId = '';
        if (inAppMessages.extras && inAppMessages.extras['msg-id']) {
            msgId = inAppMessages.extras['msg-id'];
        }
        appboy.display.showInAppMessage(inAppMessages, null, () => {
            logToHadoopMessage(
                uuid,
                'seen_inapp_message',
                'success',
                'info',
                {
                    braze_msg_id: msgId,
                },
            );
        });
    } else {
        logToHadoopMessage(
            uuid,
            'seen_inapp_message',
            'failed',
            'fatal',
            {
                braze_msg_id: null,
            },
        );
    }
};
