// src/views/InteractiveViewPpt.jsx
import React, { useEffect, useState } from 'react';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { db, appId } from '../firebase';
import { Save, RefreshCw, Plus, Trash2 } from 'lucide-react';
import Lottie from 'lottie-react';
import ufoAnimation from '../ufo.json';

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const defaultSlide = (idx) => ({
    id: Date.now() + idx,
    type: 'slide',
    layout: 'title+bullets',
    title: `Slide ${idx + 1}`,
    bullets: [],
    notes: [],
    images: [],
    content: { generated: { title: '', bullets: [], html: '' } }
});

const getItemHtml = (item) => {
    if (!item) return '';
    const c = item.content;
    if (!c) return '';
    const g = c.generated || {};
    if (g.html) return g.html;
    if (g.text) return `<p>${(g.text || '').replace(/\n/g, '<br/>')}</p>`;
    if (g.bullets && Array.isArray(g.bullets)) {
        return `<ul>${g.bullets.map(b => `<li>${b}</li>`).join('')}</ul>`;
    }
    // fallback for structured top-level slide object
    if (item.title || (item.bullets && item.bullets.length) || (item.notes && item.notes.length)) {
        const parts = [];
        if (item.title) parts.push(`<h3>${item.title}</h3>`);
        if (Array.isArray(item.bullets) && item.bullets.length) {
            parts.push(`<ul>${item.bullets.map(b => `<li>${b}</li>`).join('')}</ul>`);
        }
        if (Array.isArray(item.notes) && item.notes.length) {
            parts.push(item.notes.map(n => `<p>${n}</p>`).join(''));
        }
        return parts.join('');
    }
    return '';
};

const InteractiveViewPpt = ({ setView, userId, displayName, onSignOut, selectedProjectId, setSelectedProjectId, draftProject, setDraftProject }) => {
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeIndex, setActiveIndex] = useState(0);
    const [saving, setSaving] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [bgColor, setBgColor] = useState('#ffffff');
    const [contentKey, setContentKey] = useState(0);

    useEffect(() => {
        if (!selectedProjectId) {
            setProject(draftProject || { outline: [defaultSlide(0)], docType: 'pptx', mainTopic: '' });
            setLoading(false);
            return;
        }
        setLoading(true);
        const ref = doc(db, `artifacts/${appId}/users/${userId}/projects`, selectedProjectId);
        const unsub = onSnapshot(ref, (snap) => {
            if (snap.exists()) setProject({ id: snap.id, ...snap.data() });
            setLoading(false);
        }, (err) => {
            console.error('PPT editor: failed to load project', err);
            setLoading(false);
        });
        return () => unsub();
    }, [selectedProjectId, userId, draftProject]);

    const slides = project?.outline || [];

    const [localHtml, setLocalHtml] = useState('');
    const editor = useEditor({
        extensions: [StarterKit, Image, Placeholder.configure({ placeholder: 'Edit slide content...' })],
        content: localHtml || '',
        onUpdate: ({ editor }) => setLocalHtml(editor.getHTML())
    });

    useEffect(() => {
        if (!project) return;
        const slide = slides[activeIndex] || null;
        const html = getItemHtml(slide) || (slide?.content?.generated?.html || '') || '';
        setLocalHtml(html);
        if (editor) editor.commands.setContent(html || '<p></p>', false);
        if (slide?.meta?.bgColor) setBgColor(slide.meta.bgColor);
    }, [project, activeIndex, editor]);

    const ensureProject = () => project || { outline: [] };

    const handleAddSlide = () => {
        const p = ensureProject();
        const newSlide = defaultSlide((p.outline || []).length);
        const newOutline = [...(p.outline || []), newSlide];
        setProject(prev => ({ ...(prev || {}), outline: newOutline }));
        if (!p.id && typeof setDraftProject === 'function') setDraftProject({ ...(project || {}), outline: newOutline });
        setActiveIndex(newOutline.length - 1);
    };

    const handleDeleteSlide = (index) => {
        const newOutline = slides.filter((_, i) => i !== index);
        setProject(prev => ({ ...(prev || {}), outline: newOutline }));
        if (typeof setDraftProject === 'function') setDraftProject({ ...(project || {}), outline: newOutline });
        setActiveIndex(Math.max(0, Math.min(newOutline.length - 1, index)));
    };

    const handleSaveSlide = async () => {
        const slide = slides[activeIndex];
        if (!slide) return;
        setSaving(true);
        try {
            const generated = { ...(slide.content?.generated || {}), html: localHtml, title: slide.title };
            const newSlide = { ...slide, content: { ...(slide.content || {}), generated }, meta: { ...(slide.meta || {}), lastEditedAt: Date.now(), bgColor } };
            const newOutline = [...slides];
            newOutline[activeIndex] = newSlide;

            const projectDocId = project?.id || selectedProjectId;
            if (projectDocId) {
                await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/projects`, projectDocId), {
                    outline: newOutline,
                    updatedAt: serverTimestamp()
                });
            } else if (typeof setDraftProject === 'function') {
                setDraftProject({ ...(project || {}), outline: newOutline });
            }

            setProject(prev => ({ ...(prev || {}), outline: newOutline }));
        } catch (err) {
            console.error('Save slide failed', err);
            alert('Save failed — check console.');
        } finally {
            setSaving(false);
        }
    };

    // navigation helpers
    const handleGoDashboard = () => {
        // clear selected project and go back to dashboard
        if (typeof setSelectedProjectId === 'function') setSelectedProjectId(null);
        if (typeof setView === 'function') setView('dashboard');
    };

    const handleRegenerate = async () => {
        const slide = slides[activeIndex];
        if (!slide) return;

        setRegenerating(true);
        try {
            const itemId = slide.id ? String(slide.id) : null;
            const projectObj = {
                id: project?.id || selectedProjectId || null,
                docType: 'pptx',
                mainTopic: project?.mainTopic || '',
                outline: slides
            };

            const res = await fetch(`${API_BASE.replace(/\/$/, '')}/regenerate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    item_id: itemId,
                    originalItem: slide,
                    project: projectObj,
                    feedback_text: feedback || '',
                    userId,
                    temperature: 0.2
                })
            });

            if (!res.ok) {
                const body = await res.text();
                throw new Error(`Regenerate failed: ${res.status} ${body}`);
            }

            const generated = await res.json();

            // Build fallback HTML if needed
            let html = '';
            if (generated.html) {
                html = generated.html;
            } else if (generated.text) {
                html = `<p>${(generated.text || '').replace(/\n/g, '<br/>')}</p>`;
            } else if (generated.title || (generated.bullets && generated.bullets.length) || (generated.notes && generated.notes.length)) {
                const parts = [];
                if (generated.title) parts.push(`<h3>${generated.title}</h3>`);
                if (Array.isArray(generated.bullets) && generated.bullets.length) parts.push(`<ul>${generated.bullets.map(b => `<li>${b}</li>`).join('')}</ul>`);
                if (Array.isArray(generated.notes) && generated.notes.length) parts.push(generated.notes.map(n => `<p>${n}</p>`).join(''));
                if (Array.isArray(generated.images) && generated.images.length) parts.push(generated.images.map(src => `<img src="${src}" style="max-width:100%;display:block;margin:8px 0" />`).join(''));
                html = parts.join('');
            } else {
                html = '';
            }

            const newSlide = { ...slide, content: { ...(slide.content || {}), generated }, meta: { ...(slide.meta || {}), regenerated_at: Date.now() } };
            const newOutline = [...slides];
            newOutline[activeIndex] = newSlide;

            const projectDocId = project?.id || selectedProjectId;
            if (projectDocId) {
                await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/projects`, projectDocId), {
                    outline: newOutline,
                    updatedAt: serverTimestamp()
                });
            } else if (typeof setDraftProject === 'function') {
                setDraftProject({ ...(project || {}), outline: newOutline });
            }

            setProject(prev => ({ ...(prev || {}), outline: newOutline }));

            // Apply to editor and force remount
            setLocalHtml(html);
            if (editor) editor.commands.setContent(html || '<p></p>');
            setContentKey(k => k + 1);

            const gotUseful = Boolean(html) || (Array.isArray(generated.bullets) && generated.bullets.length);
            if (gotUseful) setFeedback('');
        } catch (err) {
            console.error('Regenerate slide failed', err);
            alert('Regenerate failed — check console.');
        } finally {
            setRegenerating(false);
        }
    };

    // Loading & empty project guards (early returns)
    if (loading) return <div className="min-h-[60vh] flex items-center justify-center">Loading...</div>;
    if (!project) return (
        <div className="p-8 text-center">
            <p>No project loaded. Go back to dashboard.</p>
            <button className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded" onClick={handleGoDashboard}>Back</button>
        </div>
    );

    const currentSlide = slides[activeIndex] || defaultSlide(0);

    const setLayout = (layout) => {
        const newOutline = [...slides];
        newOutline[activeIndex] = { ...(newOutline[activeIndex] || {}), layout };
        setProject(prev => ({ ...(prev || {}), outline: newOutline }));
    };

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

            <aside className="w-64 bg-white rounded-xl shadow p-4 overflow-y-auto" style={{ height: '90vh' }}>
                <div className="flex justify-between items-center mb-4">
                    <div className="text-lg font-bold">Slides</div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleAddSlide} className="p-1 rounded bg-indigo-50"><Plus /></button>
                        <button onClick={handleGoDashboard} className="p-1 rounded text-sm text-gray-500 ml-2">Close</button>
                    </div>
                </div>

                <div className="space-y-2">
                    {slides.map((s, idx) => (
                        <div
                            key={s.id || idx}
                            className={`p-3 rounded-md mb-2 cursor-pointer flex justify-between items-center ${idx === activeIndex ? 'bg-indigo-50 border-l-4 border-indigo-500' : 'hover:bg-gray-50'}`}
                            onClick={() => setActiveIndex(idx)}
                        >
                            <div className="truncate">
                                <div className="font-semibold text-sm truncate">{s.title || `Slide ${idx + 1}`}</div>
                                <div className="text-xs text-gray-400 mt-1">{s.layout}</div>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteSlide(idx); }} className="ml-2 text-red-500"><Trash2 /></button>
                        </div>
                    ))}
                </div>
            </aside>

            <main className="flex-1 bg-white rounded-xl shadow p-6 overflow-auto" style={{ height: '90vh' }}>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-2xl font-bold">{project?.mainTopic || ''}</h2>
                        <p className="text-sm text-gray-500 mt-1">Editing slide {activeIndex + 1} — {currentSlide.title || ''}</p>
                    </div>

                    <div className="flex items-center space-x-2">
                        <button onClick={handleSaveSlide} disabled={saving} className="px-3 py-2 bg-indigo-600 text-white rounded flex items-center space-x-2">
                            <Save className="w-4 h-4" />
                            <span>{saving ? 'Saving...' : 'Save'}</span>
                        </button>
                        <button onClick={handleRegenerate} disabled={regenerating} className="px-3 py-2 bg-yellow-600 text-white rounded flex items-center space-x-2">
                            <RefreshCw className="w-4 h-4" />
                            <span>{regenerating ? 'Regenerating...' : 'Remake'}</span>
                        </button>
                    </div>
                </div>

                <div className="border rounded-lg p-4 min-h-[60vh] flex gap-4">
                    <div className="flex-1 bg-white rounded shadow-sm p-6" style={{ background: bgColor }}>
                        <input
                            className="w-full mb-3 text-xl font-bold border-b pb-2 focus:outline-none"
                            value={currentSlide.title || ''}
                            onChange={(e) => {
                                const newOutline = [...slides];
                                newOutline[activeIndex] = { ...(newOutline[activeIndex] || {}), title: e.target.value };
                                setProject(prev => ({ ...(prev || {}), outline: newOutline }));
                            }}
                            placeholder="Slide title"
                        />

                        <div className="prose max-w-none">
                            <EditorContent editor={editor} key={contentKey} />
                        </div>
                    </div>

                    <div className="w-64">
                        <div className="mb-4">
                            <label className="block text-sm font-medium">Layout</label>
                            <select value={currentSlide.layout} onChange={(e) => setLayout(e.target.value)} className="w-full p-2 border rounded mt-2">
                                <option value="title">Title</option>
                                <option value="title+bullets">Title + Bullets</option>
                                <option value="title+image">Title + Image</option>
                            </select>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium">Background</label>
                            <input
                                type="color"
                                value={bgColor}
                                onChange={(e) => {
                                    setBgColor(e.target.value);
                                    const newOutline = [...slides];
                                    newOutline[activeIndex] = { ...(newOutline[activeIndex] || {}), meta: { ...(newOutline[activeIndex]?.meta || {}), bgColor: e.target.value } };
                                    setProject(prev => ({ ...(prev || {}), outline: newOutline }));
                                }}
                                className="mt-2 w-full h-10 p-0 border rounded"
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium">Regenerate feedback</label>
                            <textarea
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                className="w-full p-2 border rounded mt-2"
                                rows={4}
                                placeholder="Short notes for the AI (tone, examples, shorten...)"
                            />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default InteractiveViewPpt;

