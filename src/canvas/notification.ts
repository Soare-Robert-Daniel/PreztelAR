let lastNotificationTime = 0;

function requestPermission(callback?: () => void) {
    return () => {
        Notification.requestPermission( permission => {
            if( permission === 'granted' ) {
                callback?.()
            }
        })
    }
    
}
const createYouAreAPretzelNotification = requestPermission(() => {
    // if(document.visibilityState === 'visible') {
    //     return;
    // }

    const currentTime = Date.now()

    // Notification once in 10 minutes
    if(currentTime - lastNotificationTime >= 10 * 60 * 1000) {
        return;
    }

    const title = "Correct your posture, Pretzel!"
    const body = "You like like a pretzel, straight up that neck."
    const icon = "https://media.newyorker.com/photos/60521c4b9274613edb14f271/1:1/w_1865,h_1865,c_limit/210329_r38112.jpg"
    const notification = new Notification(title, {body, icon})

    notification.onclick = () => {
        notification.close()
        window.parent.focus()
    }
})

export default createYouAreAPretzelNotification;