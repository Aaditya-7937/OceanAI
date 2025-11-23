import React from 'react';
// OutlineView Component (src/views/OutlineView.jsx)
const OutlineView = ({ setView, userId, displayName, onSignOut, selectedProjectId, setSelectedProjectId }) => {
    const [project, setProject] = useState(null);
    const [loadingProject, setLoadingProject] = useState(true);
    const [newTitle, setNewTitle] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);

    // Fetch project data and set up real-time listener
    useEffect(() => {
        if (!db || !selectedProjectId) {
            setView('dashboard'); // Redirect if no project is selected
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
    }, [userId, selectedProjectId, setView]);

    const handleAddTitle = async () => {
        if (!newTitle.trim() || !project) return;

        setIsSaving(true);
        try {
            const projectRef = doc(db, `artifacts/${appId}/users/${userId}/projects`, selectedProjectId);

            // Add a new outline item. Structure: { title: string, content: string (empty initially) }
            const newOutlineItem = {
                id: Date.now(), // Simple unique ID for list
                title: newTitle.trim(),
                content: ""
            };

            await updateDoc(projectRef, {
                outline: arrayUnion(newOutlineItem)
            });

            setNewTitle('');
            setError(null);
        } catch (err) {
            console.error("Error adding title:", err);
            setError("Could not add title. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    // Function to reorder the outline (move item up or down)
    const handleReorder = async (index, direction) => {
        if (!project || isSaving) return;

        const outline = [...project.outline];
        const newIndex = index + direction;

        if (newIndex >= 0 && newIndex < outline.length) {
            const itemToMove = outline.splice(index, 1)[0];
            outline.splice(newIndex, 0, itemToMove);

            setIsSaving(true);
            try {
                const projectRef = doc(db, `artifacts/${appId}/users/${userId}/projects`, selectedProjectId);
                await updateDoc(projectRef, { outline: outline });
            } catch (err) {
                console.error("Error reordering outline:", err);
                setError("Could not reorder outline.");
            } finally {
                setIsSaving(false);
            }
        }
    };

    // Function to delete an outline item
    const handleDeleteTitle = async (id) => {
        if (!project || isSaving) return;

        const updatedOutline = project.outline.filter(item => item.id !== id);

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
    };

    const docName = project?.docType === 'docx' ? 'Section Header' : 'Slide Title';

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
                <button
                    onClick={() => { setView('dashboard'); setSelectedProjectId(null); }}
                    className="flex items-center text-sm text-gray-600 hover:text-indigo-600 transition duration-150 active:scale-[.98]"
                >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back to Dashboard
                </button>
                <button
                    onClick={onSignOut}
                    className="py-1 px-3 text-xs bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition duration-150"
                >
                    Sign Out
                </button>
            </div>

            <h1 className="text-3xl font-extrabold text-gray-900 mb-1">Define Outline</h1>
            <p className="text-gray-500 mb-2">Step 2: Structure your document ({project.docType.toUpperCase()}).</p>
            <div className="p-3 bg-indigo-50 border-l-4 border-indigo-500 rounded-lg mb-6">
                <p className="font-semibold text-indigo-800 line-clamp-1">Topic: {project.mainTopic}</p>
            </div>

            {error && (
                <div className="flex items-start p-3 mb-4 bg-red-100 border border-red-400 text-red-700 rounded-xl">
                    <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <span className="ml-3 text-sm">{error}</span>
                </div>
            )}

            {/* Current Outline List */}
            <div className="space-y-3 mb-8">
                <h3 className="text-xl font-bold text-gray-700">{docName} List ({project.outline.length})</h3>
                {project.outline.length === 0 ? (
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
                                    {/* Up Button */}
                                    <button
                                        onClick={() => handleReorder(index, -1)}
                                        disabled={index === 0 || isSaving}
                                        title="Move Up"
                                        className="p-1 rounded-full text-gray-500 hover:text-indigo-600 hover:bg-indigo-100 transition disabled:opacity-30 disabled:hover:bg-transparent"
                                    >
                                        <ChevronUp className="w-4 h-4" />
                                    </button>

                                    {/* Down Button */}
                                    <button
                                        onClick={() => handleReorder(index, 1)}
                                        disabled={index === project.outline.length - 1 || isSaving}
                                        title="Move Down"
                                        className="p-1 rounded-full text-gray-500 hover:text-indigo-600 hover:bg-indigo-100 transition disabled:opacity-30 disabled:hover:bg-transparent"
                                    >
                                        <ChevronDown className="w-4 h-4" />
                                    </button>

                                    {/* Delete Button */}
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
                // This is where the AI Generation step will be initiated in the next stage
                onClick={() => console.log('Proceed to AI Generation for project:', selectedProjectId)}
                disabled={isSaving || project.outline.length === 0}
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