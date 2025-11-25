// src/views/ConfigurationView.jsx
import React, { useState, useEffect } from 'react';
import { ChevronLeft, FileText, Presentation, Loader2, Settings } from 'lucide-react';
// don't import Firestore here anymore for create; we persist later from OutlineView
// keep db/appId import only if you still want to persist here (we do not need it now)

const ConfigurationView = ({ setView, userId, displayName, onSignOut, setSelectedProjectId, draftProject, setDraftProject }) => {
    const [docType, setDocType] = useState(draftProject?.docType || ''); // 'docx' or 'pptx'
    const [mainTopic, setMainTopic] = useState(draftProject?.mainTopic || '');
    const [isSaving, setIsSaving] = useState(false);

    // keep draftProject in sync with local inputs
    useEffect(() => {
        if (setDraftProject) {
            setDraftProject({
                ...(draftProject || {}),
                docType: docType || '',
                mainTopic: mainTopic || '',
                outline: draftProject?.outline || []
            });
        }
    }, [docType, mainTopic]); // eslint-disable-line

    // NEW: don't persist here. Save draft and navigate to Outline.
    const handleCreateProject = async () => {
        if (!docType || !mainTopic.trim()) {
            console.error("Please select a document type and enter a topic.");
            return;
        }

        setIsSaving(true);
        try {
            // Persist draft in memory (so OutlineView sees it)
            if (setDraftProject) {
                setDraftProject({
                    ...(draftProject || {}),
                    docType,
                    mainTopic: mainTopic.trim(),
                    outline: draftProject?.outline || []
                });
            }

            // route to outline (no Firestore call here)
            setSelectedProjectId(null); // explicitly indicate we are working on a draft
            setView('outline');
        } catch (err) {
            console.error('Failed to save draft', err);
        } finally {
            setIsSaving(false);
        }
    };

    // show toggle only when draft contains something
    const draftHasData = Boolean((docType && docType !== '') || (mainTopic && mainTopic.trim().length > 0) || (draftProject && (draftProject.outline && draftProject.outline.length > 0)));

    return (
        <div className="max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-2xl">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-3">
                    <button
                        onClick={() => setView('dashboard')}
                        className="flex items-center text-sm text-gray-600 hover:text-indigo-600 transition duration-150 active:scale-[.98]"
                    >
                        <ChevronLeft className="w-4 h-4 mr-1" /> Back to Dashboard
                    </button>
                    {/* If there's draft data and no selected project, show a small "Go to Outline" button */}
                    {draftHasData && (
                        <button
                            onClick={() => { setSelectedProjectId(null); setView('outline'); }}
                            className="text-sm text-indigo-600 hover:text-indigo-800 ml-3 px-3 py-1 rounded-md border border-indigo-100"
                        >
                            Go to Outline
                        </button>
                    )}
                </div>

                <button
                    onClick={onSignOut}
                    className="py-1 px-3 text-xs bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition duration-150"
                >
                    Sign Out
                </button>
            </div>

            <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Configure Project</h1>
            <p className="text-gray-500 mb-8">Step 1: Define your goal for the AI assistant.</p>

            {/* Document Type Selection */}
            <div className="mb-8">
                <label className="block text-lg font-semibold text-gray-700 mb-3">Choose Project Format</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* DOCX Option */}
                    <button
                        onClick={() => setDocType('docx')}
                        className={`p-6 border-4 rounded-xl transition duration-200 text-left ${docType === 'docx'
                            ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                            }`}
                    >
                        <FileText className={`w-8 h-8 mb-2 ${docType === 'docx' ? 'text-indigo-600' : 'text-gray-400'}`} />
                        <span className="block text-xl font-bold text-gray-800">Microsoft Word (.docx)</span>
                        <span className="text-sm text-gray-500">Structured reports, proposals, long-form documents.</span>
                    </button>

                    {/* PPTX Option */}
                    <button
                        onClick={() => setDocType('pptx')}
                        className={`p-6 border-4 rounded-xl transition duration-200 text-left ${docType === 'pptx'
                            ? 'border-green-600 bg-green-50 shadow-lg'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                            }`}
                    >
                        <Presentation className={`w-8 h-8 mb-2 ${docType === 'pptx' ? 'text-green-600' : 'text-gray-400'}`} />
                        <span className="block text-xl font-bold text-gray-800">Microsoft PowerPoint (.pptx)</span>
                        <span className="text-sm text-gray-500">Slide decks, presentations, visual summaries.</span>
                    </button>
                </div>
            </div>

            {/* Main Topic Input */}
            <div className="mb-8">
                <label htmlFor="mainTopic" className="block text-lg font-semibold text-gray-700 mb-3">
                    Main Topic / Prompt
                </label>
                <textarea
                    id="mainTopic"
                    rows="4"
                    value={mainTopic}
                    onChange={(e) => setMainTopic(e.target.value)}
                    placeholder="E.g., A market analysis of the EV industry in 2025 focusing on battery supply chain issues."
                    className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-150 resize-none"
                    disabled={isSaving}
                />
                <p className="text-sm text-gray-500 mt-2">Be detailed. This prompt defines the core content for the AI.</p>
            </div>

            {/* Action Button now sets draft and routes to outline */}
            <button
                onClick={handleCreateProject}
                disabled={isSaving || !docType || !mainTopic.trim()}
                className="w-full py-3 flex items-center justify-center space-x-2 bg-indigo-600 text-white font-bold text-lg rounded-xl shadow-xl hover:bg-indigo-700 transition duration-150 active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isSaving ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Saving draft...</span>
                    </>
                ) : (
                    <>
                        <Settings className="w-5 h-5" />
                        <span>Continue to Outline Definition ({docType ? `.${docType.toUpperCase()}` : '...'})</span>
                    </>
                )}
            </button>
            {/* Note for next step */}
            {docType && (
                <p className="mt-4 text-sm text-center text-indigo-700 font-medium p-2 bg-indigo-50 rounded-lg">
                    Next: You will define the {docType === 'docx' ? 'section headers' : 'slide titles'} for your document.
                </p>
            )}
        </div>
    );
};
export default ConfigurationView;

