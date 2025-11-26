// src/views/InteractiveRouter.jsx
import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import InteractiveViewDocx from './InteractiveViewDocx.jsx';
import InteractiveViewPpt from './InteractiveViewPpt.jsx';
import { db, appId } from '../firebase';
import AnimatedLoader from '../components/Shared/AnimatedLoader.jsx';

/**
 * InteractiveRouter
 * - Props forwarded from App.jsx: setView, userId, displayName, onSignOut, selectedProjectId, setSelectedProjectId, draftProject, setDraftProject
 * - Subscribes to Firestore doc when selectedProjectId is present to read docType
 * - Priority:
 *    1. If firestore project has docType -> use it
 *    2. Else if draftProject has docType -> use it
 *    3. Else fallback to 'docx'
 */
const InteractiveRouter = ({
    setView,
    userId,
    displayName,
    onSignOut,
    selectedProjectId,
    setSelectedProjectId,
    draftProject,
    setDraftProject
}) => {
    const [loading, setLoading] = useState(true);
    const [projectDoc, setProjectDoc] = useState(null); // full project doc from firestore (if any)
    const [error, setError] = useState(null);

    useEffect(() => {
        // if no selected project, we can finish loading immediately (use draftProject)
        if (!selectedProjectId) {
            setProjectDoc(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        const ref = doc(db, `artifacts/${appId}/users/${userId}/projects`, selectedProjectId);
        const unsub = onSnapshot(ref, (snap) => {
            if (snap.exists()) {
                setProjectDoc({ id: snap.id, ...snap.data() });
            } else {
                setProjectDoc(null);
            }
            setLoading(false);
        }, (err) => {
            console.error('InteractiveRouter: failed to load project', err);
            setError(err);
            setLoading(false);
        });

        return () => unsub();
    }, [selectedProjectId, userId]);

    if (loading) {
        return <div className="min-h-[60vh] flex items-center justify-center"><AnimatedLoader /></div>;
    }

    // pick docType with clear priority:
    const docType = (projectDoc && projectDoc.docType) || (draftProject && draftProject.docType) || 'docx';

    if (docType === 'pptx') {
        return (
            <InteractiveViewPpt
                setView={setView}
                userId={userId}
                displayName={displayName}
                onSignOut={onSignOut}
                selectedProjectId={selectedProjectId}
                setSelectedProjectId={setSelectedProjectId}
                draftProject={draftProject}
                setDraftProject={setDraftProject}
            />
        );
    }

    // default to docx editor
    return (
        <InteractiveViewDocx
            setView={setView}
            userId={userId}
            displayName={displayName}
            onSignOut={onSignOut}
            selectedProjectId={selectedProjectId}
            setSelectedProjectId={setSelectedProjectId}
            draftProject={draftProject}
            setDraftProject={setDraftProject}
        />
    );
};

export default InteractiveRouter;
