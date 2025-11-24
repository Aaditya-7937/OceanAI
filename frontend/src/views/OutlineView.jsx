import React, { useState, useEffect } from 'react';
import {
    doc,
    onSnapshot,
    updateDoc,
    arrayUnion,
} from 'firebase/firestore';
import { ChevronLeft, Loader2, AlertTriangle, Menu, ChevronUp, ChevronDown, Trash2, Plus, Zap } from 'lucide-react';
import { db, appId } from '../firebase';

// OutlineView Component (src/views/OutlineView.jsx)
const OutlineView = ({ setView, userId, displayName, onSignOut, selectedProjectId, setSelectedProjectId, draftProject, setDraftProject }) => {
    const [project, setProject] = useState(draftProject || null);
    const [loadingProject, setLoadingProject] = useState(Boolean(selectedProjectId)); // only true if we'll fetch
    const [newTitle, setNewTitle] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);

    // If a selectedProjectId exists, fetch from Firestore (existing behavior)
    useEffect(() => {
        if (!db) {
            setError('Database not available');
            setLoadingProject(false);
            return;
        }

        if (!selectedProjectId) {
            // no persisted project: load draftProject if available
            setProject(draftProject || { outline: [], docType: draftProject?.docType || 'docx', mainTopic: draftProject?.mainTopic || '' });
            setLoadingProject(false);
            return;
        }

        setLoadingProject(true);
        const projectRef = doc(db, `artifacts/${appId}/users/${userId}/projects`, selectedProjectId);
        const unsubscribe = onSnapshot(projectRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
                setProject({ id: docSnapshot.id, ...docSnapshot.data() });
                setLoadingProject(false);
                setError(null);
            } else {
                setError("Project not found.");
                setLoadingProject(false);
                setProject(null);
            }
        }, (err) => {
            console.error("Error fetching project:", err);
            setError("Failed to load project details.");
            setLoadingProject(false);
        });

        return () => unsubscribe();
    }, [userId, selectedProjectId]); // eslint-disable-line

    // Persist outline changes to draftProject if not saved to Firestore
    useEffect(() => {
        if (!selectedProjectId && setDraftProject) {
            setDraftProject({
                ...(draftProject || {}),
                docType: project?.docType,
                mainTopic: project?.mainTopic,
                outline: project?.outline || []
            });
        }
    }, [project?.outline]); // eslint-disable-line

    const handleAddTitle = async () => {
        if (!newTitle.trim()) return;

        // If project is persisted in Firestore
        if (selectedProjectId) {
            setIsSaving(true);
            try {
                const projectRef = doc(db, `artifacts/${appId}/users/${userId}/projects`, selectedProjectId);
                const newOutlineItem = { id: Date.now(), title: newTitle.trim(), content: "" };
                await updateDoc(projectRef, { outline: arrayUnion(newOutlineItem) });
                setNewTitle('');
                setError(null);
            } catch (err) {
                console.error("Error adding title:", err);
                setError("Could not add title. Please try again.");
            } finally {
                setIsSaving(false);
            }
            return;
        }

        // Otherwise mutate local project draft
        const newOutlineItem = { id: Date.now(), title: newTitle.trim(), content: "" };
        setProject(prev => ({ ...(prev || {}), outline: [...(prev?.outline || []), newOutlineItem] }));
        setNewTitle('');
    };

    // Reorder/delete logic: if persisted, perform updateDoc; else update local project object
    const updateLocalOutline = (outline) => {
        setProject(prev => ({ ...(prev || {}), outline }));
    };

    const handleReorder = async (index, direction) => {
        if (!project || isSaving) return;
        const outline = [...(project.outline || [])];
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= outline.length) return;
        const item = outline.splice(index, 1)[0];
        outline.splice(newIndex, 0, item);

        if (selectedProjectId) {
            setIsSaving(true);
            try {
                const projectRef = doc(db, `artifacts/${appId}/users/${userId}/projects`, selectedProjectId);
                await updateDoc(projectRef, { outline });
            } catch (err) {
                console.error("Error reordering outline:", err);
                setError("Could not reorder outline.");
            } finally {
                setIsSaving(false);
            }
        } else {
            updateLocalOutline(outline);
        }
    };

    const handleDeleteTitle = async (id) => {
        if (!project || isSaving) return;
        const updatedOutline = (project.outline || []).filter(item => item.id !== id);

        if (selectedProjectId) {
            setIsSaving(true);
            try {
                const projectRef = doc(db, `artifacts/${appId}/users/${userId}/projects`, selectedProjectId);
                await updateDoc(projectRef, { outline: updatedOutline });
            } catch (err) {
                console.error("Error deleting title:", err);
                setError("Could not delete title. Please try again.");
            } finally {
                setIsSaving(false);
            }
        } else {
            updateLocalOutline(updatedOutline);
        }
    };

    const docName = project?.docType === 'docx' ? 'Section Header' : 'Slide Title';

    // show toggle only when there is draftProject data
    const draftHasData = Boolean((draftProject && ((draftProject.docType && draftProject.docType !== '') || (draftProject.mainTopic && draftProject.mainTopic.trim().length > 0) || (draftProject.outline && draftProject.outline.length > 0))));

    if (loadingProject) {
        return (
            <div className="max-w-4xl mx-auto p-12 bg-white rounded-xl shadow-2xl text-center">
                <Loader2 className="w-8 h-8 mx-auto animate-spin text-indigo-500 mb-4" />
                <p className="text-gray-600">Loading project details...</p>
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="max-w-4xl mx-auto p-12 bg-white rounded-xl shadow-2xl text-center">
                <AlertTriangle className="w-8 h-8 mx-auto text-red-500 mb-4" />
                <p className="text-red-600">{error}</p>
                <button
                    onClick={() => setView('dashboard')}
                    className="mt-4 text-sm text-indigo-600 hover:text-indigo-800 transition active:scale-[.98]"
                >
                    Go back to Dashboard
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-2xl">
            <div className="flex justify-between items-center mb-6 border-b pb-3">
                <div className="flex items-center">
                    {/* Back to Dashboard */}
                    <button
                        onClick={() => { setView('dashboard'); setSelectedProjectId(null); }}
                        className="flex items-center text-sm text-gray-600 hover:text-indigo-600 transition duration-150 active:scale-[.98]"
                    >
                        <ChevronLeft className="w-4 h-4 mr-1" /> Back to Dashboard
                    </button>

                    {/* If draft data exists and this project is NOT persisted, show Edit Config toggle */}
                    {!selectedProjectId && draftHasData && (
                        <button
                            onClick={() => setView('configure')}
                            className="ml-4 text-sm text-indigo-600 hover:text-indigo-800 transition px-3 py-1 rounded-md border border-indigo-100"
                        >
                            Edit Configuration
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

            <h1 className="text-3xl font-extrabold text-gray-900 mb-1">Define Outline</h1>
            <p className="text-gray-500 mb-2">Step 2: Structure your document ({(project?.docType || 'docx').toUpperCase()}).</p>
            <div className="p-3 bg-indigo-50 border-l-4 border-indigo-500 rounded-lg mb-6">
                <p className="font-semibold text-indigo-800 line-clamp-1">Topic: {project?.mainTopic}</p>
            </div>

            {/* Current Outline List */}
            <div className="space-y-3 mb-8">
                <h3 className="text-xl font-bold text-gray-700">{docName} List ({project?.outline?.length || 0})</h3>
                {(!project?.outline || project.outline.length === 0) ? (
                    <div className="p-6 text-center border-2 border-dashed border-gray-200 rounded-xl text-gray-500">
                        <Menu className="w-6 h-6 mx-auto mb-2" />
                        No {docName.toLowerCase()}s added yet. Start by adding the Introduction.
                    </div>
                ) : (
                    <div className="bg-gray-50 rounded-xl p-3 space-y-2 max-h-80 overflow-y-auto shadow-inner">
                        {project.outline.map((item, index) => (
                            <div
                                key={item.id}
                                className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm"
                            >
                                <div className="flex items-center flex-grow min-w-0">
                                    <span className="text-sm font-semibold mr-3 text-indigo-500 w-5 text-right">{index + 1}.</span>
                                    <span className="text-gray-800 font-medium truncate flex-grow">{item.title}</span>
                                </div>

                                <div className="flex space-x-1.5 ml-4">
                                    <button
                                        onClick={() => handleReorder(index, -1)}
                                        disabled={index === 0 || isSaving}
                                        title="Move Up"
                                        className="p-1 rounded-full text-gray-500 hover:text-indigo-600 hover:bg-indigo-100 transition disabled:opacity-30 disabled:hover:bg-transparent"
                                    >
                                        <ChevronUp className="w-4 h-4" />
                                    </button>

                                    <button
                                        onClick={() => handleReorder(index, 1)}
                                        disabled={index === project.outline.length - 1 || isSaving}
                                        title="Move Down"
                                        className="p-1 rounded-full text-gray-500 hover:text-indigo-600 hover:bg-indigo-100 transition disabled:opacity-30 disabled:hover:bg-transparent"
                                    >
                                        <ChevronDown className="w-4 h-4" />
                                    </button>

                                    <button
                                        onClick={() => handleDeleteTitle(item.id)}
                                        disabled={isSaving}
                                        title="Delete"
                                        className="p-1 rounded-full text-gray-500 hover:text-red-600 hover:bg-red-100 transition disabled:opacity-30 disabled:hover:bg-transparent"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add New Title Input */}
            <div className="flex space-x-3 mb-8">
                <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder={`Enter a new ${docName.toLowerCase()} (e.g., Executive Summary)`}
                    className="flex-grow p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-150"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddTitle(); }}
                    disabled={isSaving}
                />
                <button
                    onClick={handleAddTitle}
                    disabled={isSaving || !newTitle.trim()}
                    className="py-3 px-5 bg-indigo-600 text-white font-bold rounded-xl shadow-md hover:bg-indigo-700 transition duration-150 active:scale-[.98] disabled:opacity-50"
                >
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            {/* Final Action Button (Proceed to Generation) */}
            <button
                onClick={() => console.log('Proceed to AI Generation for project:', selectedProjectId)}
                disabled={isSaving || !(project?.outline && project.outline.length > 0)}
                className="w-full py-3 flex items-center justify-center space-x-2 bg-green-600 text-white font-bold text-lg rounded-xl shadow-xl hover:bg-green-700 transition duration-150 active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isSaving ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Updating Outline...</span>
                    </>
                ) : (
                    <>
                        <Zap className="w-5 h-5" />
                        <span>Start AI Content Generation</span>
                    </>
                )}
            </button>
            <p className="mt-4 text-sm text-center text-green-700 font-medium p-2 bg-green-50 rounded-lg">
                The next step involves calling the LLM backend to generate content for each {docName.toLowerCase()}.
            </p>
        </div>
    );
};
export default OutlineView;
