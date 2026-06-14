package ie.pitchnote.app;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.text.TextUtils;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;
import java.util.Locale;
import org.json.JSONException;

@CapacitorPlugin(
    name = "OnDeviceSpeech",
    permissions = {
        @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone")
    }
)
public class OnDeviceSpeechPlugin extends Plugin {

    private SpeechRecognizer recognizer;
    private PluginCall activeCall;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        boolean available = SpeechRecognizer.isRecognitionAvailable(getContext());
        result.put("available", available);
        result.put("reason", available ? "" : "recognizer_unavailable");
        call.resolve(result);
    }

    @PluginMethod
    public void recognize(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphonePermissionCallback");
            return;
        }
        startRecognition(call);
    }

    @PermissionCallback
    private void microphonePermissionCallback(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            call.reject("Microphone permission was denied.", "PERMISSION_DENIED");
            return;
        }
        startRecognition(call);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        finish();
        call.resolve();
    }

    private void startRecognition(PluginCall call) {
        if (activeCall != null) {
            call.reject("Speech recognition is already running.");
            return;
        }

        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            call.reject("Speech recognizer is unavailable.", "UNAVAILABLE");
            return;
        }

        activeCall = call;
        recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
        recognizer.setRecognitionListener(new RecognitionListener() {
            @Override
            public void onReadyForSpeech(Bundle params) {}

            @Override
            public void onBeginningOfSpeech() {}

            @Override
            public void onRmsChanged(float rmsdB) {}

            @Override
            public void onBufferReceived(byte[] buffer) {}

            @Override
            public void onEndOfSpeech() {}

            @Override
            public void onError(int error) {
                rejectActive(errorMessage(error));
            }

            @Override
            public void onResults(Bundle results) {
                resolveResults(results);
            }

            @Override
            public void onPartialResults(Bundle partialResults) {}

            @Override
            public void onEvent(int eventType, Bundle params) {}
        });

        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, call.getString("locale", Locale.UK.toLanguageTag()));

        ArrayList<String> contextualStrings = getContextualStrings(call);
        if (!contextualStrings.isEmpty()) {
            intent.putStringArrayListExtra(RecognizerIntent.EXTRA_BIASING_STRINGS, contextualStrings);
            intent.putExtra(
                RecognizerIntent.EXTRA_PROMPT,
                TextUtils.join(", ", contextualStrings.subList(0, Math.min(8, contextualStrings.size())))
            );
        }

        recognizer.startListening(intent);

        Integer maxDurationMs = call.getInt("maxDurationMs", 4500);
        getBridge().executeOnMainThread(() -> {
            getActivity().getWindow().getDecorView().postDelayed(() -> {
                if (activeCall == call && recognizer != null) {
                    recognizer.stopListening();
                }
            }, maxDurationMs);
        });
    }

    private ArrayList<String> getContextualStrings(PluginCall call) {
        ArrayList<String> values = new ArrayList<>();
        JSArray array = call.getArray("contextualStrings");
        if (array == null) return values;
        try {
            for (Object value : array.toList()) {
                String text = String.valueOf(value).trim();
                if (!text.isEmpty()) values.add(text);
            }
        } catch (JSONException ignored) {}
        return values;
    }

    private void resolveResults(Bundle results) {
        PluginCall call = activeCall;
        if (call == null) {
            finish();
            return;
        }

        ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        float[] confidences = results.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES);
        JSArray alternatives = new JSArray();
        if (matches != null) {
            for (int i = 0; i < matches.size(); i += 1) {
                JSObject alternative = new JSObject();
                alternative.put("transcript", matches.get(i));
                alternative.put("confidence", confidences != null && i < confidences.length ? confidences[i] : 0);
                alternatives.put(alternative);
            }
        }

        JSObject result = new JSObject();
        result.put("transcript", matches != null && !matches.isEmpty() ? matches.get(0) : "");
        result.put("confidence", confidences != null && confidences.length > 0 ? confidences[0] : 0);
        result.put("alternatives", alternatives);
        finish();
        call.resolve(result);
    }

    private void rejectActive(String message) {
        PluginCall call = activeCall;
        finish();
        if (call != null) call.reject(message);
    }

    private void finish() {
        if (recognizer != null) {
            recognizer.destroy();
            recognizer = null;
        }
        activeCall = null;
    }

    private String errorMessage(int error) {
        if (error == SpeechRecognizer.ERROR_NETWORK || error == SpeechRecognizer.ERROR_NETWORK_TIMEOUT) {
            return "Offline speech recognition is unavailable on this device.";
        }
        if (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
            return "No speech heard.";
        }
        if (error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) {
            return "Microphone permission was denied.";
        }
        return "Speech recognition failed.";
    }
}
