import UserNotifications

/// Rich-push support for Moonfeed.
/// The backend sets `apns.fcmOptions.imageUrl` on the FCM payload, which Apple
/// delivers as `fcm_options.image` in the notification's userInfo. This
/// extension downloads that image (coin picture or wallet avatar) and attaches
/// it so the notification shows the picture instead of just the app icon.
/// If anything fails, the original notification is delivered unchanged.
final class NotificationService: UNNotificationServiceExtension {

    private var contentHandler: ((UNNotificationContent) -> Void)?
    private var bestAttempt: UNMutableNotificationContent?
    private var downloadTask: URLSessionDownloadTask?

    override func didReceive(
        _ request: UNNotificationRequest,
        withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
    ) {
        self.contentHandler = contentHandler
        guard let bestAttempt = request.content.mutableCopy() as? UNMutableNotificationContent else {
            contentHandler(request.content)
            return
        }
        self.bestAttempt = bestAttempt

        guard
            let fcmOptions = bestAttempt.userInfo["fcm_options"] as? [String: Any],
            let imageURLString = fcmOptions["image"] as? String,
            let imageURL = URL(string: imageURLString),
            let scheme = imageURL.scheme?.lowercased(),
            scheme == "https"
        else {
            contentHandler(bestAttempt)
            return
        }

        let task = URLSession.shared.downloadTask(with: imageURL) { [weak self] location, _, _ in
            guard let self, let bestAttempt = self.bestAttempt, let handler = self.contentHandler else { return }
            defer { handler(bestAttempt) }
            guard let location else { return }

            // The attachment file URL must carry an image extension or iOS drops it.
            let ext = imageURL.pathExtension.lowercased()
            let safeExt = ["png", "jpg", "jpeg", "gif", "webp"].contains(ext) ? ext : "png"
            let tmpFile = URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)
                .appendingPathComponent(ProcessInfo.processInfo.globallyUniqueString)
                .appendingPathExtension(safeExt)
            do {
                try FileManager.default.copyItem(at: location, to: tmpFile)
                if let attachment = try? UNNotificationAttachment(identifier: "image", url: tmpFile, options: nil) {
                    bestAttempt.attachments = [attachment]
                }
            } catch {
                // Deliver without the image rather than failing the notification.
            }
        }
        downloadTask = task
        task.resume()
    }

    override func serviceExtensionTimeWillExpire() {
        // About to be killed — deliver whatever we have.
        downloadTask?.cancel()
        if let handler = contentHandler, let bestAttempt = bestAttempt {
            handler(bestAttempt)
        }
    }
}
