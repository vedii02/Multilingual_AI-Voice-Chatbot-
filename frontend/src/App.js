import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Volume2, Loader2, MessageSquare, Languages, CheckCircle, XCircle, Edit2 } from 'lucide-react';

const App = () => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [editedTranscript, setEditedTranscript] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('auto');
  const [detectedLanguage, setDetectedLanguage] = useState('');
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  const languages = [
    { code: 'auto', name: 'Select', flag: '🌍' },
    { code: 'en-US', name: 'English', flag: '🇺🇸' },
    { code: 'es-ES', name: 'Spanish', flag: '🇪🇸' },
    { code: 'fr-FR', name: 'French', flag: '🇫🇷' },
    { code: 'de-DE', name: 'German', flag: '🇩🇪' },
    { code: 'it-IT', name: 'Italian', flag: '🇮🇹' },
    { code: 'pt-BR', name: 'Portuguese', flag: '🇧🇷' },
    { code: 'hi-IN', name: 'Hindi', flag: '🇮🇳' },
    { code: 'zh-CN', name: 'Chinese', flag: '🇨🇳' },
    { code: 'ja-JP', name: 'Japanese', flag: '🇯🇵' },
    { code: 'ko-KR', name: 'Korean', flag: '🇰🇷' },
    { code: 'ar-SA', name: 'Arabic', flag: '🇸🇦' },
    { code: 'ru-RU', name: 'Russian', flag: '🇷🇺' },
  ];

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event) => {
        const speechResult = event.results[0][0].transcript;
        const detectedLang = selectedLanguage === 'auto' ? (event.results[0][0].lang || 'en-US') : selectedLanguage;
        
        setTranscript(speechResult);
        setEditedTranscript(speechResult);
        setDetectedLanguage(detectedLang);
        setIsListening(false);
        setShowConfirmation(true); // Show confirmation box
      };

      recognitionRef.current.onerror = (event) => {
        setError(`Speech recognition error: ${event.error}`);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    } else {
      setError('❌ Speech recognition not supported. Please use Google Chrome.');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      synthRef.current.cancel();
    };
  }, [selectedLanguage]);

  const startListening = () => {
    setError('');
    setTranscript('');
    setEditedTranscript('');
    setShowConfirmation(false);
    
    if (recognitionRef.current) {
      try {
        if (selectedLanguage === 'auto') {
          recognitionRef.current.lang = '';
        } else {
          recognitionRef.current.lang = selectedLanguage;
        }
        
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        setError('Failed to start listening: ' + err.message);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const handleConfirm = async () => {
    setShowConfirmation(false);
    
    const userMsg = { role: 'user', content: editedTranscript, language: detectedLanguage };
    setMessages(prev => [...prev, userMsg]);

    await getAIResponse(editedTranscript, detectedLanguage);
  };

  const handleCancel = () => {
    setShowConfirmation(false);
    setTranscript('');
    setEditedTranscript('');
    setError('Message cancelled. Click microphone to try again.');
  };

  const getAIResponse = async (userInput, language) => {
    setIsProcessing(true);
    
    try {
      const response = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userInput,
          language: language
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.response;

      const aiMsg = { role: 'assistant', content: aiResponse, language };
      setMessages(prev => [...prev, aiMsg]);

      await speakText(aiResponse, language);
      
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to get AI response: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const speakText = async (text, language) => {
    return new Promise((resolve) => {
      synthRef.current.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      const langMap = {
        'en-US': 'en-US',
        'es-ES': 'es-ES',
        'fr-FR': 'fr-FR',
        'de-DE': 'de-DE',
        'it-IT': 'it-IT',
        'pt-BR': 'pt-BR',
        'hi-IN': 'hi-IN',
        'zh-CN': 'zh-CN',
        'ja-JP': 'ja-JP',
        'ko-KR': 'ko-KR',
        'ar-SA': 'ar-SA',
        'ru-RU': 'ru-RU'
      };

      utterance.lang = langMap[language] || language || 'en-US';
      utterance.rate = 0.9;
      utterance.pitch = 1;

      const voices = synthRef.current.getVoices();
      const matchingVoice = voices.find(voice => voice.lang.startsWith(utterance.lang.split('-')[0]));
      if (matchingVoice) {
        utterance.voice = matchingVoice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        resolve();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        resolve();
      };

      synthRef.current.speak(utterance);
    });
  };

  const stopSpeaking = () => {
    synthRef.current.cancel();
    setIsSpeaking(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <Languages className="w-8 h-8 text-purple-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Multilingual Voice Chatbot</h1>
                <p className="text-sm text-gray-600">Speak → Confirm → Get AI Response</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="px-4 py-2 border-2 border-purple-300 rounded-lg text-sm font-semibold focus:outline-none focus:border-purple-500"
              >
                {languages.map(lang => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>
              {detectedLanguage && (
                <div className="bg-purple-100 px-3 py-1 rounded-full text-sm text-purple-700">
                  {detectedLanguage}
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 mb-4">
            <p className="text-yellow-800 text-sm">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg p-8 mb-4">
          <div className="flex flex-col items-center gap-6">
            <button
              onClick={isListening ? stopListening : startListening}
              disabled={isProcessing || isSpeaking || showConfirmation}
              className={`w-32 h-32 rounded-full flex items-center justify-center transition-all transform hover:scale-105 ${
                isListening
                  ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                  : 'bg-purple-600 hover:bg-purple-700'
              } ${(isProcessing || isSpeaking || showConfirmation) ? 'opacity-50 cursor-not-allowed' : ''} shadow-xl`}
            >
              {isListening ? (
                <MicOff className="w-16 h-16 text-white" />
              ) : (
                <Mic className="w-16 h-16 text-white" />
              )}
            </button>

            <div className="text-center">
              {isListening && (
                <p className="text-lg font-semibold text-purple-600 animate-pulse">
                  🎤 Listening... Speak now
                </p>
              )}
              {isProcessing && (
                <div className="flex items-center gap-2 text-blue-600">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <p className="text-lg font-semibold">Getting AI Response...</p>
                </div>
              )}
              {isSpeaking && (
                <div className="flex items-center gap-2 text-green-600">
                  <Volume2 className="w-5 h-5 animate-pulse" />
                  <p className="text-lg font-semibold">Speaking...</p>
                  <button
                    onClick={stopSpeaking}
                    className="ml-2 px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                  >
                    Stop
                  </button>
                </div>
              )}
              {!isListening && !isProcessing && !isSpeaking && !showConfirmation && (
                <p className="text-gray-600">Click the microphone to start talking</p>
              )}
            </div>

            {/* Confirmation Box */}
            {showConfirmation && (
              <div className="w-full bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-6 border-2 border-purple-300 shadow-lg">
                <div className="flex items-center gap-2 mb-4">
                  <Edit2 className="w-5 h-5 text-purple-600" />
                  <h3 className="text-lg font-bold text-gray-800">
                    Confirm Your Message
                  </h3>
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    You said (you can edit):
                  </label>
                  <textarea
                    value={editedTranscript}
                    onChange={(e) => setEditedTranscript(e.target.value)}
                    className="w-full p-4 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none text-lg"
                    rows="3"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    ✏️ Edit the text if needed, then click Confirm
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleConfirm}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all shadow-md"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Confirm & Send
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all shadow-md"
                  >
                    <XCircle className="w-5 h-5" />
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {messages.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5 text-purple-600" />
              <h2 className="text-xl font-bold text-gray-800">Conversation History</h2>
            </div>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-purple-50 border-l-4 border-purple-500'
                      : 'bg-blue-50 border-l-4 border-blue-500'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-700">
                      {msg.role === 'user' ? '👤 You' : '🤖 AI'}
                    </span>
                    <span className="text-xs text-gray-500">{msg.language}</span>
                  </div>
                  <p className="text-gray-800">{msg.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg p-6 mt-4">
          <h3 className="font-semibold text-gray-800 mb-3">📝 How It Works</h3>
          <ol className="space-y-2 text-sm text-gray-700">
            <li><strong>1️⃣ Speak:</strong> Click microphone and speak in any language</li>
            <li><strong>2️⃣ Review:</strong> Check the text - edit if needed</li>
            <li><strong>3️⃣ Confirm:</strong> Click "Confirm & Send" to get AI response</li>
            <li><strong>4️⃣ Listen:</strong> AI responds in the same language</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default App;
