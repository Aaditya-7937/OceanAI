// src/views/InteractiveViewDocx.jsx
import React, { useEffect, useState } from 'react';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { db, appId } from '../firebase';
import { Save, RefreshCw } from 'lucide-react';
import Lottie from 'lottie-react';
import ufoAnimation from '../ufo.json';
import { TextStyle } from '@tiptap/extension-text-style';
import { FontFamily } from '@tiptap/extension-font-family';
import { Link } from '@tiptap/extension-link';
import { TextAlign } from '@tiptap/extension-text-align';

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

/**
 * InteractiveViewDocx: document-style editor (lightweight Google Docs MVP).
 * - Title bar
 * - Toolbar: headings, bold/italic/strike, lists, undo/redo
 * - Global font family & size controls (applies to whole doc)
 * - Insert Image (URL)
 * - Save/regenerate backed by your existing backend shape
 *
 * Notes: per-selection font-style would require TipTap additions; this keeps things simple
 * and robust by applying font-family/size to entire document (persisted in project.meta).
 */
// Custom FontSize extension (TipTap doesn't include one)
import { Mark, mergeAttributes } from '@tiptap/core';

const FontSize = Mark.create({
    name: 'fontSize',

    addOptions() {
        return {
            types: ['textStyle'],
        };
    },

    parseHTML() {
        return [
            {
                style: 'font-size',
                getAttrs: value => {
                    const size = value.replace('px', '');
                    return size ? { size } : false;
                },
            },
        ];
    },

    renderHTML({ mark, HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes, { style: `font-size: ${mark.attrs.size}px` }), 0];
    },

    addAttributes() {
        return {
            size: {
                default: null,
                parseHTML: element => element.style.fontSize?.replace('px', '') || null,
                renderHTML: attrs => {
                    if (!attrs.size) return {};
                    return { style: `font-size: ${attrs.size}px` };
                },
            },
        };
    },

    addCommands() {
        return {
            setFontSize:
                size =>
                    ({ commands }) => {
                        return commands.setMark(this.name, { size });
                    },
            unsetFontSize:
                () =>
                    ({ commands }) => {
                        return commands.unsetMark(this.name);
                    },
        };
    },
});

const InteractiveViewDocx = ({ setView, userId, displayName, onSignOut, selectedProjectId, setSelectedProjectId, draftProject, setDraftProject }) => {
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeIndex, setActiveIndex] = useState(0);
    const [saving, setSaving] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [contentKey, setContentKey] = useState(0);

    // Global style controls (applied to whole doc as inline wrapper)
    const [fontSize, setFontSize] = useState(16);
    const [fontFamily, setFontFamily] = useState('Inter, system-ui, sans-serif');

    useEffect(() => {
        if (!selectedProjectId) {
            setProject(draftProject || null);
            // if draft contains meta with font settings, apply them
            if (draftProject?.meta?.fontSize) setFontSize(draftProject.meta.fontSize);
            if (draftProject?.meta?.fontFamily) setFontFamily(draftProject.meta.fontFamily);
            setLoading(false);
            return;
        }
        setLoading(true);
        const ref = doc(db, `artifacts/${appId}/users/${userId}/projects`, selectedProjectId);
        const unsub = onSnapshot(ref, (snap) => {
            if (snap.exists()) {
                const data = { id: snap.id, ...snap.data() };
                setProject(data);
                if (data.meta?.fontSize) setFontSize(data.meta.fontSize);
                if (data.meta?.fontFamily) setFontFamily(data.meta.fontFamily);
            }
            setLoading(false);
        }, (err) => {
            console.error('Docx editor: failed to load project', err);
            setLoading(false);
        });
        return () => unsub();
    }, [selectedProjectId, userId, draftProject]);

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
        // Structured fallback (title / bullets / notes)
        if (item.title || (item.bullets && item.bullets.length) || (item.notes && item.notes.length)) {
            const parts = [];
            if (item.title) parts.push(`<h3>${item.title}</h3>`);
            if (Array.isArray(item.bullets) && item.bullets.length) parts.push(`<ul>${item.bullets.map(b => `<li>${b}</li>`).join('')}</ul>`);
            if (Array.isArray(item.notes) && item.notes.length) parts.push(item.notes.map(n => `<p>${n}</p>`).join(''));
            return parts.join('');
        }
        return '';
    };

    const [localHtml, setLocalHtml] = useState('');
    const [localTitle, setLocalTitle] = useState('');
    const editor = useEditor({
        extensions: [
            StarterKit,
            Image,
            Placeholder.configure({ placeholder: 'Write your section here...' }),

            // NEW POWER FEATURES
            TextStyle,          // needed for font-size + family
            FontFamily.configure({
                types: ['textStyle'],
            }),
            FontSize,           // custom extension we added
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            Link.configure({
                openOnClick: true,
                autolink: true,
                linkOnPaste: true,
            }),
        ],
        content: localHtml || '',
        onUpdate: ({ editor }) => setLocalHtml(editor.getHTML())
    });


    useEffect(() => {
        if (!project) return;
        const item = (project.outline || [])[activeIndex] || null;
        const html = getItemHtml(item) || '<p></p>';
        setLocalHtml(html);
        setLocalTitle(project?.mainTopic || '');
        if (editor) {
            // wrap with global font container so fontSize/fontFamily are applied visually
            const wrapper = `<div style="font-family:${fontFamily};font-size:${fontSize}px;">${html}</div>`;
            editor.commands.setContent(wrapper, false);
        }
    }, [project, activeIndex, editor]);

    // Simple toolbar helpers (safe commands from StarterKit)
    const toggleMark = (mark) => editor && editor.chain().focus()[mark]().run();
    const setHeading = (level) => editor && editor.chain().focus().toggleHeading({ level }).run();
    const toggleList = (type) => editor && editor.chain().focus()[type]().run();
    const undo = () => editor && editor.commands.undo && editor.commands.undo();
    const redo = () => editor && editor.commands.redo && editor.commands.redo();

    // Apply a global font size by wrapping the entire editor content in a styled div.
    // This is a robust way to visually control font-size without extra TipTap extensions.
    const applyGlobalFontSize = (size) => {
        setFontSize(size);
        if (!editor) return;
        const inner = editor.getHTML() || '<p></p>';
        const wrapper = `<div style="font-family:${fontFamily};font-size:${size}px;">${inner}</div>`;
        editor.commands.setContent(wrapper);
    };

    const applyGlobalFontFamily = (family) => {
        setFontFamily(family);
        if (!editor) return;
        const inner = editor.getHTML() || '<p></p>';
        const wrapper = `<div style="font-family:${family};font-size:${fontSize}px;">${inner}</div>`;
        editor.commands.setContent(wrapper);
    };

    const handleInsertImage = () => {
        const url = prompt('Image URL:');
        if (url && editor) editor.chain().focus().setImage({ src: url }).run();
    };

    // navigation helpers
    const handleGoDashboard = () => {
        if (typeof setSelectedProjectId === 'function') setSelectedProjectId(null);
        if (typeof setView === 'function') setView('dashboard');
    };

    const handleSave = async () => {
        if (!project) return;
        const outline = project.outline || [];
        const item = outline[activeIndex];
        if (!item) return;
        setSaving(true);
        try {
            // strip global wrapper from editor HTML when saving into generated.html
            let htmlToSave = editor ? editor.getHTML() : localHtml;
            // if our wrapper exists, try to remove outer wrapper div that we added for global styles
            // This is a simple heuristic — if wrapper present, remove first-level div
            if (htmlToSave?.startsWith('<div') && htmlToSave.includes('>') && htmlToSave.endsWith('</div>')) {
                // remove only outermost div tags
                const inner = htmlToSave.replace(/^<div[^>]*>/i, '').replace(/<\/div>$/i, '');
                htmlToSave = inner;
            }

            const newItem = {
                ...item,
                content: {
                    ...(item.content || {}),
                    generated: {
                        ...(item.content?.generated || {}),
                        html: htmlToSave,
                        text: (editor && editor.getText()) || ''
                    }
                },
                meta: { ...(item.meta || {}), lastEditedAt: Date.now(), lastEditedBy: userId }
            };
            const newOutline = [...outline];
            newOutline[activeIndex] = newItem;

            // update project-level title & meta (persist font settings)
            const projectDocId = project?.id || selectedProjectId;
            const projectUpdate = {
                outline: newOutline,
                updatedAt: serverTimestamp(),
                mainTopic: localTitle || project?.mainTopic || ''
            };
            // save font preferences in project meta to persist across reloads
            projectUpdate.meta = { ...(project.meta || {}), fontSize, fontFamily };

            if (projectDocId) {
                await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/projects`, projectDocId), projectUpdate);
            } else {
                // draft in memory
                if (typeof setDraftProject === 'function') setDraftProject({ ...(project || {}), ...projectUpdate });
            }

            setProject(prev => ({ ...(prev || {}), ...projectUpdate }));
        } catch (err) {
            console.error('Docx save failed', err);
            alert('Save failed — check console.');
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
            const rawItemId = item?.id ?? (item?.content?.generated?.id ?? null);
            const itemIdAsString = rawItemId != null ? String(rawItemId) : null;
            const projectObj = {
                id: (project?.id || selectedProjectId) || null,
                docType: project?.docType || 'docx',
                mainTopic: project?.mainTopic || '',
                outline: project?.outline || []
            };

            const res = await fetch(`${API_BASE.replace(/\/$/, '')}/regenerate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    item_id: itemIdAsString,
                    originalItem: item,
                    project: projectObj,
                    feedback_text: feedback || '',
                    userId,
                    temperature: 0.2
                })
            });

            if (!res.ok) {
                const txt = await res.text();
                throw new Error(`Regenerate failed: ${res.status} ${txt}`);
            }

            const generated = await res.json();

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

            const newItem = { ...item, content: { ...(item.content || {}), generated }, meta: { ...(item.meta || {}), regenerated_at: Date.now() } };
            const newOutline = [...outline];
            newOutline[activeIndex] = newItem;

            const projectDocId = project?.id || selectedProjectId;
            if (projectDocId) {
                await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/projects`, projectDocId), {
                    outline: newOutline,
                    updatedAt: serverTimestamp()
                });
            } else {
                if (typeof setDraftProject === 'function') setDraftProject({ ...(project || {}), outline: newOutline });
            }

            setProject(prev => ({ ...(prev || {}), outline: newOutline }));
            // when applying, wrap with global font wrapper so font settings persist visually
            const wrapper = `<div style="font-family:${fontFamily};font-size:${fontSize}px;">${html}</div>`;
            setLocalHtml(html);
            if (editor) editor.commands.setContent(wrapper || '<p></p>');
            setContentKey(k => k + 1);
            const gotUseful = Boolean(html) || (Array.isArray(generated.bullets) && generated.bullets.length);
            if (gotUseful) setFeedback('');
        } catch (err) {
            console.error('Docx regenerate failed', err);
            alert('Regenerate failed — check console.');
        } finally {
            setRegenerating(false);
        }
    };

    if (loading) return <div className="min-h-[60vh] flex items-center justify-center">Loading...</div>;
    if (!project) return (
        <div className="p-8 text-center">
            <p>No project loaded. Go back to dashboard.</p>
            <button className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded" onClick={handleGoDashboard}>Back</button>
        </div>
    );

    const outlineItems = project.outline || [];

    return (
        <div className="min-h-screen flex flex-col space-y-4 p-6">
            {/* UFO Lottie overlay while regenerating */}
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

            {/* Title bar */}
            <div className="bg-white rounded-xl shadow px-6 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <button onClick={handleGoDashboard} className="text-sm text-gray-500">Close</button>
                    <input value={localTitle} onChange={(e) => setLocalTitle(e.target.value)} placeholder="Document title" className="text-xl font-semibold outline-none" />
                </div>

                <div className="flex items-center space-x-2">
                    <select value={fontFamily} onChange={(e) => applyGlobalFontFamily(e.target.value)} className="p-2 border rounded">
                        <option value="Inter, system-ui, sans-serif">Inter</option>
                        <option value="Georgia, serif">Georgia</option>
                        <option value="Arial, Helvetica, sans-serif">Arial</option>
                        <option value="Times New Roman, Times, serif">Times New Roman</option>
                    </select>

                    <div className="flex items-center space-x-1">
                        <button onClick={() => applyGlobalFontSize(Math.max(10, fontSize - 1))} className="px-2 py-1 border rounded">A-</button>
                        <div className="px-2">{fontSize}px</div>
                        <button onClick={() => applyGlobalFontSize(fontSize + 1)} className="px-2 py-1 border rounded">A+</button>
                    </div>

                    <button onClick={undo} title="Undo" className="p-2 border rounded">↶</button>
                    <button onClick={redo} title="Redo" className="p-2 border rounded">↷</button>

                    <button onClick={handleSave} disabled={saving} className="px-3 py-2 bg-indigo-600 text-white rounded flex items-center space-x-2">
                        <Save className="w-4 h-4" />
                        <span>{saving ? 'Saving...' : 'Save'}</span>
                    </button>

                    <button onClick={handleRegenerate} disabled={regenerating} className="px-3 py-2 bg-yellow-600 text-white rounded flex items-center space-x-2">
                        <RefreshCw className="w-4 h-4" />
                        <span>{regenerating ? 'Regenerating...' : 'Remake'}</span>
                    </button>
                </div>
            </div>

            <div className="flex gap-6">
                {/* Outline / sections */}
                <aside className="w-72 bg-white rounded-xl shadow p-4 overflow-y-auto" style={{ height: '70vh' }}>
                    <div className="text-lg font-bold mb-4">Sections</div>
                    {outlineItems.length === 0 ? <p className="text-sm text-gray-500">No section headers.</p> :
                        outlineItems.map((it, idx) => (
                            <div key={it.id || idx} className={`p-3 rounded-md mb-2 cursor-pointer ${idx === activeIndex ? 'bg-indigo-50 border-l-4 border-indigo-500' : 'hover:bg-gray-50'}`} onClick={() => setActiveIndex(idx)}>
                                <div className="font-semibold text-sm truncate">{it.title}</div>
                                <div className="text-xs text-gray-400 mt-1">{it.content?.generated?.text ? `${(it.content.generated.text || '').slice(0, 80)}...` : (it.content?.generated?.html ? 'Generated' : 'Not generated')}</div>
                            </div>
                        ))
                    }
                </aside>

                {/* Editor area */}
                <main className="flex-1 bg-white rounded-xl shadow p-6 overflow-auto" style={{ height: '70vh' }}>
                    {/* Editor toolbar (inline) */}
                    {/* Editor toolbar (full Google Docs style) */}
                    <div className="mb-3 flex flex-wrap items-center gap-2">

                        {/* Font Family */}
                        <select
                            value={fontFamily}
                            onChange={(e) => {
                                editor.chain().focus().setFontFamily(e.target.value).run();
                                setFontFamily(e.target.value);
                            }}
                            className="p-1 border rounded"
                        >
                            <option value="Inter, system-ui, sans-serif">Inter</option>
                            <option value="Georgia, serif">Georgia</option>
                            <option value="Arial, Helvetica, sans-serif">Arial</option>
                            <option value="Times New Roman, Times, serif">Times New Roman</option>
                        </select>

                        {/* Font Size */}
                        <select
                            value={fontSize}
                            onChange={(e) => {
                                const size = parseInt(e.target.value);
                                editor.chain().focus().setFontSize(size).run();
                                setFontSize(size);
                            }}
                            className="p-1 border rounded"
                        >
                            {[12, 14, 16, 18, 20, 24, 28, 32].map(s => (
                                <option key={s} value={s}>{s}px</option>
                            ))}
                        </select>

                        {/* Alignment */}
                        <button className="px-2 py-1 border rounded" onClick={() => editor.chain().focus().setTextAlign('left').run()}>Left</button>
                        <button className="px-2 py-1 border rounded" onClick={() => editor.chain().focus().setTextAlign('center').run()}>Center</button>
                        <button className="px-2 py-1 border rounded" onClick={() => editor.chain().focus().setTextAlign('right').run()}>Right</button>
                        <button className="px-2 py-1 border rounded" onClick={() => editor.chain().focus().setTextAlign('justify').run()}>Justify</button>

                        {/* Bold / Italic / Strike */}
                        <button className="px-2 py-1 border rounded" onClick={() => toggleMark('toggleBold')}>Bold</button>
                        <button className="px-2 py-1 border rounded" onClick={() => toggleMark('toggleItalic')}>Italic</button>
                        <button className="px-2 py-1 border rounded" onClick={() => toggleMark('toggleStrike')}>Strike</button>

                        {/* Headings */}
                        <button className="px-2 py-1 border rounded" onClick={() => setHeading(1)}>H1</button>
                        <button className="px-2 py-1 border rounded" onClick={() => setHeading(2)}>H2</button>

                        {/* Lists */}
                        <button className="px-2 py-1 border rounded" onClick={() => toggleList('toggleBulletList')}>Bullets</button>
                        <button className="px-2 py-1 border rounded" onClick={() => toggleList('toggleOrderedList')}>Numbered</button>

                        {/* Insert Link */}
                        <button
                            className="px-2 py-1 border rounded"
                            onClick={() => {
                                const url = prompt("Enter URL:");
                                if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
                            }}
                        >
                            Link
                        </button>

                        {/* Remove Link */}
                        <button
                            className="px-2 py-1 border rounded"
                            onClick={() => editor.chain().focus().unsetLink().run()}
                        >
                            Unlink
                        </button>

                        {/* Insert Image */}
                        <button className="px-2 py-1 border rounded" onClick={handleInsertImage}>Image</button>
                    </div>


                    <div className="border rounded-lg p-4 min-h-[50vh]" style={{ fontFamily }}>
                        {/* Key forces a remount when regenerated content arrives */}
                        <EditorContent editor={editor} key={contentKey} />
                    </div>

                    <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700">Regenerate feedback (optional)</label>
                        <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} className="w-full p-3 mt-2 border rounded" placeholder="Tell the AI what to change (tone, length, focus, add examples...)"></textarea>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default InteractiveViewDocx;

