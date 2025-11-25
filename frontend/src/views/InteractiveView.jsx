// src/views/InteractiveView.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { db, appId } from '../firebase';
import { ChevronLeft, Loader2, Edit, Save, RefreshCw } from 'lucide-react';
import Lottie from 'lottie-react';
import ufoAnimation from '../ufo.json';

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const InteractiveView = ({ setView, userId, displayName, onSignOut, selectedProjectId, setSelectedProjectId }) => {
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeIndex, setActiveIndex] = useState(0);
    const [saving, setSaving] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [feedback, setFeedback] = useState('');

    useEffect(() => {
        if (!selectedProjectId) {
            setLoading(false);
            setProject(null);
            return;
        }
        setLoading(true);
        const ref = doc(db, `artifacts/${appId}/users/${userId}/projects`, selectedProjectId);
        const unsub = onSnapshot(ref, (docSnap) => {
            if (docSnap.exists()) {
                setProject({ id: docSnap.id, ...docSnap.data() });
            }
            setLoading(false);
        }, (err) => {
            console.error('InteractiveView: failed to load project', err);
            setLoading(false);
        });
        return () => unsub();
    }, [selectedProjectId, userId]);

    const getItemHtml = (item) => {
        if (!item) return '';
        const c = item.content;
        if (!c) return '';
        const g = c.generated || {};
        if (g.html) return g.html;
        if (g.text) return `<p>${g.text.replace(/\n/g, '<br/>')}</p>`;
        if (g.bullets && Array.isArray(g.bullets)) {
            return `<ul>${g.bullets.map(b => `<li>${b}</li>`).join('')}</ul>`;
        }
        return '';
    };

    const [localHtml, setLocalHtml] = useState('');
    const editor = useEditor({
        extensions: [
            StarterKit,
            Image,
            Placeholder.configure({ placeholder: 'Edit content here...' }),
        ],
        content: localHtml || '',
        onUpdate: ({ editor }) => {
            setLocalHtml(editor.getHTML());
        }
    });

    useEffect(() => {
        if (!project) return;
        const outline = project.outline || [];
        const item = outline[activeIndex] || null;
        const html = getItemHtml(item) || '<p></p>';
        setLocalHtml(html);
        if (editor) {
            editor.commands.setContent(html, false);
        }
    }, [project, activeIndex, editor]);

    const handleSave = async () => {
        if (!project) return;
        const outline = project.outline || [];
        const item = outline[activeIndex];
        if (!item) return;

        setSaving(true);
        try {
            const newItem = {
                ...item,
                content: {
                    ...(item.content || {}),
                    generated: {
                        ...(item.content?.generated || {}),
                        html: localHtml,
                        text: (editor && editor.getText()) || ''
                    }
                },
                meta: {
                    ...(item.meta || {}),
                    lastEditedAt: Date.now(),
                    lastEditedBy: userId
                }
            };

            const newOutline = [...outline];
            newOutline[activeIndex] = newItem;

            await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/projects`, selectedProjectId), {
                outline: newOutline,
                updatedAt: serverTimestamp()
            });

            setProject(prev => ({ ...(prev || {}), outline: newOutline }));
        } catch (err) {
            console.error('InteractiveView: failed to save item', err);
        } finally {
            setSaving(false);
        }
    };

    const handleRegenerate = async () => {
        if (!project) return;
        const outline = project.outline || [];
        const item = outline[activeIndex];
        if (!item) return;

        setRegenerating(true);
        try {
            // Ensure item_id is always a string (backend expects string)
            const rawItemId = item?.id ?? (item?.content?.generated?.id ?? null);
            const itemIdAsString = rawItemId != null ? String(rawItemId) : null;

            const projectObject = {
                id: selectedProjectId || project?.id || null,
                docType: project?.docType || "pptx",
                mainTopic: project?.mainTopic || "",
                outline: project?.outline || []
            };

            const res = await fetch(`${API_BASE.replace(/\/$/, '')}/regenerate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    // canonical shape matching RegenerateRequest + include full original item for robustness
                    item_id: itemIdAsString,
                    originalItem: item,                    // include full slide object so backend can use it directly
                    project: projectObject,
                    feedback_text: feedback || '',
                    userId,
                    temperature: 0.2
                })
            });;

            if (!res.ok) {
                // try to extract json error for debugging
                let txt = await res.text();
                try { txt = JSON.stringify(await res.json()); } catch (e) { }
                throw new Error(`Regenerate failed: ${res.status} ${txt}`);
            }

            const json = await res.json();

            // Backend returns the new slide object (not wrapped), so use it directly
            const generated = json || {};
            const newItem = {
                ...item,
                content: {
                    ...(item.content || {}),
                    generated
                },
                meta: {
                    ...(item.meta || {}),
                    regenerated_at: Date.now()
                }
            };

            const newOutline = [...outline];
            newOutline[activeIndex] = newItem;

            await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/projects`, selectedProjectId), {
                outline: newOutline,
                updatedAt: serverTimestamp()
            });

            setProject(prev => ({ ...(prev || {}), outline: newOutline }));
            const html = generated.html || (generated.text ? `<p>${generated.text}</p>` : '');
            setLocalHtml(html);
            editor && editor.commands.setContent(html || '<p></p>');
            setFeedback('');
        } catch (err) {
            console.error('InteractiveView: regenerate failed', err);
            alert('Regenerate failed - check console.');
        } finally {
            setRegenerating(false);
        }
    };

    const outlineItems = project?.outline || [];

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (!project) {
        return (
            <div className="p-8 text-center">
                <p>No project loaded. Go back to dashboard.</p>
                <button className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded" onClick={() => setView('dashboard')}>Back</button>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex space-x-6 p-6">
            {regenerating && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                    <div className="w-80 h-80">
                        <Lottie animationData={ufoAnimation} loop={true} />
                    </div>
                    <div className="absolute bottom-10 text-white text-lg font-semibold">
                        Regenerating content... sit tight
                    </div>
                </div>
            )}

            <aside className="w-72 bg-white rounded-xl shadow p-4 overflow-y-auto" style={{ height: '90vh' }}>
                <div className="flex justify-between items-center mb-4">
                    <div className="text-lg font-bold">Outline</div>
                    <button onClick={() => { setView('dashboard'); setSelectedProjectId(null); }} className="text-sm text-gray-500">Close</button>
                </div>

                {outlineItems.length === 0 ? (
                    <p className="text-sm text-gray-500">No outline items.</p>
                ) : (
                    outlineItems.map((it, idx) => (
                        <div key={it.id || idx} className={`p-3 rounded-md mb-2 cursor-pointer ${idx === activeIndex ? 'bg-indigo-50 border-l-4 border-indigo-500' : 'hover:bg-gray-50'}`} onClick={() => setActiveIndex(idx)}>
                            <div className="font-semibold text-sm truncate">{it.title}</div>
                            <div className="text-xs text-gray-400 mt-1">{it.content?.generated?.text ? `${(it.content.generated.text || '').slice(0, 80)}...` : (it.content?.generated?.html ? 'Generated' : 'Not generated')}</div>
                        </div>
                    ))
                )}
            </aside>

            <main className="flex-1 bg-white rounded-xl shadow p-6 overflow-auto" style={{ height: '90vh' }}>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-2xl font-bold">{project.mainTopic}</h2>
                        <p className="text-sm text-gray-500 mt-1">Editing: {outlineItems[activeIndex]?.title}</p>
                    </div>

                    <div className="flex items-center space-x-2">
                        <button onClick={handleSave} disabled={saving} className="px-3 py-2 bg-indigo-600 text-white rounded flex items-center space-x-2">
                            <Save className="w-4 h-4" />
                            <span>{saving ? 'Saving...' : 'Save'}</span>
                        </button>

                        <button onClick={() => setRegenerating(true) || handleRegenerate()} disabled={regenerating} className="px-3 py-2 bg-yellow-600 text-white rounded flex items-center space-x-2">
                            <RefreshCw className="w-4 h-4" />
                            <span>{regenerating ? 'Regenerating...' : 'Remake'}</span>
                        </button>
                    </div>
                </div>

                <div className="border rounded-lg p-4 min-h-[60vh]">
                    <EditorContent editor={editor} />
                </div>

                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700">Regenerate feedback (optional)</label>
                    <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} className="w-full p-3 mt-2 border rounded" placeholder="Tell the AI what to change (tone, length, focus, add examples...)"></textarea>
                </div>
            </main>
        </div>
    );
};

export default InteractiveView;
