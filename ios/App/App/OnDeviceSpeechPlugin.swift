import AVFoundation
import Capacitor
import Foundation
import Speech

@objc(OnDeviceSpeechPlugin)
public class OnDeviceSpeechPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OnDeviceSpeechPlugin"
    public let jsName = "OnDeviceSpeech"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "recognize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    private let audioEngine = AVAudioEngine()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var activeCall: CAPPluginCall?
    private var timeoutTimer: Timer?
    private var bestTranscript = ""
    private var bestConfidence = 0.0
    private var alternatives: [[String: Any]] = []

    @objc func isAvailable(_ call: CAPPluginCall) {
        guard #available(iOS 13.0, *) else {
            call.resolve(["available": false, "reason": "ios_13_required"])
            return
        }

        let locale = Locale(identifier: call.getString("locale") ?? "en_IE")
        guard let recognizer = SFSpeechRecognizer(locale: locale) else {
            call.resolve(["available": false, "reason": "recognizer_unavailable"])
            return
        }

        call.resolve([
            "available": recognizer.isAvailable && recognizer.supportsOnDeviceRecognition,
            "reason": recognizer.supportsOnDeviceRecognition ? "" : "offline_model_unavailable"
        ])
    }

    @objc func recognize(_ call: CAPPluginCall) {
        guard activeCall == nil else {
            call.reject("Speech recognition is already running.")
            return
        }

        guard #available(iOS 13.0, *) else {
            call.reject("On-device speech recognition requires iOS 13 or newer.", "UNAVAILABLE")
            return
        }

        SFSpeechRecognizer.requestAuthorization { status in
            DispatchQueue.main.async {
                guard status == .authorized else {
                    call.reject("Speech recognition permission was denied.", "PERMISSION_DENIED")
                    return
                }

                AVAudioSession.sharedInstance().requestRecordPermission { granted in
                    DispatchQueue.main.async {
                        guard granted else {
                            call.reject("Microphone permission was denied.", "PERMISSION_DENIED")
                            return
                        }
                        self.startRecognition(call)
                    }
                }
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        finishRecognition(resolve: true)
        call.resolve()
    }

    @available(iOS 13.0, *)
    private func startRecognition(_ call: CAPPluginCall) {
        let localeIdentifier = call.getString("locale") ?? "en_IE"
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: localeIdentifier)) else {
            call.reject("Speech recognizer is unavailable.", "UNAVAILABLE")
            return
        }

        guard recognizer.supportsOnDeviceRecognition else {
            call.reject("Offline speech model is unavailable for this language.", "UNAVAILABLE")
            return
        }

        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.record, mode: .measurement, options: [.duckOthers])
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)

            let request = SFSpeechAudioBufferRecognitionRequest()
            request.requiresOnDeviceRecognition = true
            request.shouldReportPartialResults = true
            request.contextualStrings = call.getArray("contextualStrings", String.self) ?? []

            let inputNode = audioEngine.inputNode
            let format = inputNode.outputFormat(forBus: 0)
            inputNode.removeTap(onBus: 0)
            inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
                request.append(buffer)
            }

            recognitionRequest = request
            activeCall = call
            bestTranscript = ""
            bestConfidence = 0
            alternatives = []

            audioEngine.prepare()
            try audioEngine.start()

            let maxDuration = TimeInterval(call.getInt("maxDurationMs") ?? 4500) / 1000.0
            timeoutTimer = Timer.scheduledTimer(withTimeInterval: maxDuration, repeats: false) { [weak self] _ in
                self?.finishRecognition(resolve: true)
            }

            recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
                guard let self else { return }
                if let result {
                    self.bestTranscript = result.bestTranscription.formattedString
                    self.bestConfidence = self.averageConfidence(result.bestTranscription)
                    self.alternatives = result.transcriptions.prefix(5).map { transcription in
                        [
                            "transcript": transcription.formattedString,
                            "confidence": self.averageConfidence(transcription)
                        ]
                    }
                    if result.isFinal {
                        self.finishRecognition(resolve: true)
                    }
                }
                if let error {
                    self.finishRecognition(resolve: false, error: error.localizedDescription)
                }
            }
        } catch {
            cleanup()
            call.reject(error.localizedDescription)
        }
    }

    private func averageConfidence(_ transcription: SFTranscription) -> Double {
        let segments = transcription.segments
        guard !segments.isEmpty else { return 0 }
        let total = segments.reduce(0.0) { $0 + Double($1.confidence) }
        return max(0, min(1, total / Double(segments.count)))
    }

    private func finishRecognition(resolve: Bool, error: String? = nil) {
        guard let call = activeCall else {
            cleanup()
            return
        }

        cleanup()

        if resolve {
            call.resolve([
                "transcript": bestTranscript,
                "confidence": bestConfidence,
                "alternatives": alternatives
            ])
        } else {
            call.reject(error ?? "Speech recognition failed.")
        }
    }

    private func cleanup() {
        timeoutTimer?.invalidate()
        timeoutTimer = nil
        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionRequest?.endAudio()
        recognitionRequest = nil
        if audioEngine.isRunning {
            audioEngine.stop()
            audioEngine.inputNode.removeTap(onBus: 0)
        }
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        activeCall = nil
    }
}
