import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { Zap, Plus, FileText, Presentation, Edit, Trash2, Loader2, X, AlertTriangle } from 'lucide-react';
import { db, appId } from '../firebase';


// Confirmation Modal Component
const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-11/12 max-w-md transform transition-all scale-100 duration-300">
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                    <h3 className="text-xl font-bold text-red-600 flex items-center">
                        <AlertTriangle className="w-5 h-5 mr-2" />
                        Confirm Action
                    </h3>
                    <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 p-1 rounded-full transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="space-y-3">
                    <p className="text-lg font-semibold text-gray-800">{title}</p>
                    <p className="text-gray-600">{message}</p>
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                    <button
                        onClick={onCancel}
                        className="py-2 px-4 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition duration-150 active:scale-[.98]"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="py-2 px-4 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition duration-150 active:scale-[.98] shadow-md shadow-red-200"
                    >
                        Delete Project
                    </button>
                </div>
            </div>
        </div>
    );
};


const DashboardView = ({ setView, userId, displayName, onSignOut, setSelectedProjectId }) => {
    const [projects, setProjects] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    // State for the custom confirmation modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState(null);

    // Firestore listener for projects
    useEffect(() => {
        if (!db || !userId) {
            // Check if Firebase is initialized and user is available
            console.warn("Firestore (db) or userId is not available. Skipping project listener.");
            setIsLoading(false);
            return;
        }

        const projectsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/projects`);

        // Fetch projects
        const q = query(projectsCollectionRef);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedProjects = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Sort projects in memory by createdAt descending (newest first)
            const sortedProjects = fetchedProjects.sort((a, b) => {
                // Safely access timestamp data. If missing, treat as 0 (start of time)
                const timeA = a.createdAt?.toMillis() || 0;
                const timeB = b.createdAt?.toMillis() || 0;
                return timeB - timeA; // Newest first
            });

            setProjects(sortedProjects);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching projects:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [userId]);


    const handleEditProject = (projectId) => {
        setSelectedProjectId(projectId);
        setView('outline'); // Navigate to outline view for editing structure
    };

    // 1. Function to open the custom modal
    const handleDeleteProject = (projectId, mainTopic) => {
        setProjectToDelete({ id: projectId, mainTopic });
        setIsModalOpen(true);
    };

    // 2. Function to confirm deletion from the modal
    const handleConfirmDelete = async () => {
        if (!projectToDelete) return;

        const { id: projectId, mainTopic } = projectToDelete;
        setIsModalOpen(false); // Close modal
        setProjectToDelete(null); // Clear project data immediately

        try {
            const projectRef = doc(db, `artifacts/${appId}/users/${userId}/projects`, projectId);
            await deleteDoc(projectRef);
            console.log(`Project "${mainTopic}" successfully deleted.`);
            // The onSnapshot listener handles the UI update
        } catch (error) {
            console.error("Error deleting project:", error);
            // In a real app, show a toast notification here.
        }
    };

    // 3. Function to cancel deletion
    const handleCancelDelete = () => {
        setIsModalOpen(false);
        setProjectToDelete(null);
    };


    const renderProjectCard = useCallback((project) => {
        const docIcon = project.docType === 'docx' ? <FileText className="w-6 h-6 text-indigo-500" /> : <Presentation className="w-6 h-6 text-green-500" />;
        const docColor = project.docType === 'docx' ? 'bg-indigo-50 text-indigo-700' : 'bg-green-50 text-green-700';

        // Safely convert Firestore Timestamp to Date object
        const date = project.createdAt?.toDate() || new Date();
        const formattedDate = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        // Determine status badge color
        const statusClass = project.status === 'configured' ? 'bg-yellow-500' :
            project.status === 'generated' ? 'bg-blue-500' :
                project.status === 'refined' ? 'bg-green-500' : 'bg-gray-500';

        return (
            <div
                key={project.id}
                className="bg-white p-5 border border-gray-200 rounded-xl shadow-lg hover:shadow-xl transition duration-200 flex flex-col justify-between"
            >
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                        {docIcon}
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${docColor}`}>
                            .{project.docType?.toUpperCase()}
                        </span>
                    </div>
                    {/* Status Badge */}
                    <div className="text-sm font-medium text-gray-500 flex items-center space-x-1">
                        <span className={`inline-block w-2 h-2 rounded-full ${statusClass}`}></span>
                        <span>{project.status?.charAt(0).toUpperCase() + project.status?.slice(1) || 'Draft'}</span>
                    </div>
                </div>

                <div className="mb-4 flex-grow">
                    <h3 className="text-lg font-bold text-gray-900 line-clamp-2" title={project.mainTopic}>{project.mainTopic}</h3>
                    <p className="text-xs text-gray-400 mt-1">
                        {project.outline?.length || 0} {project.docType === 'docx' ? 'Sections' : 'Slides'} | Created: {formattedDate}
                    </p>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                    <button
                        onClick={() => handleEditProject(project.id)}
                        className="flex items-center space-x-1 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition duration-150 active:scale-[.98]"
                    >
                        <Edit className="w-4 h-4" />
                        <span>Edit Structure</span>
                    </button>
                    <button
                        // Use the new handler that opens the custom modal
                        onClick={() => handleDeleteProject(project.id, project.mainTopic)}
                        className="text-gray-400 hover:text-red-500 transition duration-150 p-1 rounded-full active:scale-[.98]"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    }, [handleEditProject]); // Include handleEditProject as a dependency

    return (
        <div className="min-h-screen p-4 sm:p-8 space-y-8 bg-gray-50 rounded-2xl shadow-inner font-sans">
            <header className="flex justify-between items-center border-b pb-4">
                <h1 className="text-3xl font-extrabold text-gray-900 flex items-center space-x-3">
                    <Zap className="w-6 h-6 text-indigo-600" />
                    <span>Your Projects</span>
                </h1>
                <div className="flex items-center space-x-3">
                    <span className="text-sm text-gray-600 hidden sm:block">
                        User: <span className="font-semibold text-gray-800 truncate max-w-[150px] inline-block">{displayName || userId}</span>
                    </span>
                    <button
                        onClick={onSignOut}
                        className="py-2 px-4 text-sm bg-red-100 text-red-600 font-medium rounded-xl hover:bg-red-200 transition duration-150 active:scale-[.98] shadow-sm"
                    >
                        Sign Out
                    </button>
                </div>
            </header>

            <button
                onClick={() => {
                    setSelectedProjectId(null); // Clear selected project ID for new creation
                    setView('configure');
                }}
                className="w-full py-4 flex items-center justify-center space-x-2 bg-indigo-600 text-white font-bold text-lg rounded-xl shadow-lg hover:bg-indigo-700 transition duration-150 active:scale-[.98] transform"
            >
                <Plus className="w-6 h-6" />
                <span>Start New Project</span>
            </button>

            <section>
                <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">Previous Projects</h2>

                {isLoading && (
                    <div className="flex justify-center items-center p-10 bg-white rounded-xl shadow-md">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mr-3" />
                        <span className="text-gray-600">Loading projects...</span>
                    </div>
                )}

                {!isLoading && projects.length === 0 && (
                    <div className="text-center p-12 border-2 border-dashed border-gray-300 rounded-xl bg-white shadow-md">
                        <FileText className="w-10 h-10 mx-auto text-gray-400 mb-4" />
                        <p className="text-lg font-medium text-gray-700">No projects yet!</p>
                        <p className="text-gray-500">Click "Start New Project" to get started.</p>
                    </div>
                )}

                {!isLoading && projects.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {projects.map(renderProjectCard)}
                    </div>
                )}
            </section>

            {/* Custom Confirmation Modal */}
            <ConfirmationModal
                isOpen={isModalOpen}
                title={`Delete Project: "${projectToDelete?.mainTopic}"`}
                message="Are you absolutely sure you want to delete this project? This action cannot be undone and the project structure and content will be permanently removed."
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
            />
        </div>
    );
};

export default DashboardView;