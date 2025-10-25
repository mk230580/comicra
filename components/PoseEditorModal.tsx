import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { ImageShape, Pose, SkeletonData, SkeletonPose } from '../types';
import { XIcon, UploadIcon, BrushIcon, TrashIcon, RedoIcon, EditPoseIcon } from './icons';

interface PoseEditorModalProps {
  character: ImageShape;
  onSave: (id: string, pose: Pose) => void;
  onClose: () => void;
}

const MODAL_WIDTH = 200;
const MODAL_HEIGHT = 400;

const createInitialSkeleton = (x: number, y: number, width: number, height: number): SkeletonData => {
    const centerX = x + width / 2;
    const topY = y + height * 0.15;
    const hipY = y + height * 0.5;
    const armY = y + height * 0.3;
    const legY = y + height * 0.9;
    const shoulderWidth = width * 0.2;
    const hipWidth = width * 0.15;
    const eyeY = topY - height * 0.03;
    const eyeDistX = width * 0.07;
    const noseY = topY;
    const mouthY = topY + height * 0.05;

    return {
        head: { x: centerX, y: topY }, neck: { x: centerX, y: armY },
        leftShoulder: { x: centerX - shoulderWidth, y: armY }, rightShoulder: { x: centerX + shoulderWidth, y: armY },
        leftElbow: { x: centerX - shoulderWidth * 1.5, y: hipY }, rightElbow: { x: centerX + shoulderWidth * 1.5, y: hipY },
        leftHand: { x: centerX - shoulderWidth * 1.2, y: legY - height * 0.1 }, rightHand: { x: centerX + shoulderWidth * 1.2, y: legY - height * 0.1 },
        hips: { x: centerX, y: hipY }, leftHip: { x: centerX - hipWidth, y: hipY }, rightHip: { x: centerX + hipWidth, y: hipY },
        leftKnee: { x: centerX - hipWidth, y: hipY + height * 0.2 }, rightKnee: { x: centerX + hipWidth, y: hipY + height * 0.2 },
        leftFoot: { x: centerX - hipWidth, y: legY }, rightFoot: { x: centerX + hipWidth, y: legY },
        leftEye: { x: centerX - eyeDistX, y: eyeY }, rightEye: { x: centerX + eyeDistX, y: eyeY },
        nose: { x: centerX, y: noseY }, mouth: { x: centerX, y: mouthY },
    };
};
const skeletonConnections = [
    ['head', 'neck'], ['neck', 'leftShoulder'], ['neck', 'rightShoulder'],
    ['leftShoulder', 'leftElbow'], ['leftElbow', 'leftHand'],
    ['rightShoulder', 'rightElbow'], ['rightElbow', 'rightHand'],
    ['neck', 'hips'],
    ['hips', 'leftHip'], ['hips', 'rightHip'],
    ['leftHip', 'leftKnee'], ['leftKnee', 'leftFoot'],
    ['rightHip', 'rightKnee'], ['rightKnee', 'rightFoot'],
    ['leftEye', 'rightEye'], ['nose', 'mouth']
];

export const PoseEditorModal = ({ character, onSave, onClose }: PoseEditorModalProps): React.ReactElement => {
    // FIX: Correctly map all possible character pose types ('image', 'drawing', 'skeleton') to the modal's internal mode state.
    const [mode, setMode] = useState<'skeleton' | 'upload' | 'draw'>(character.pose?.type === 'image' ? 'upload' : character.pose?.type === 'drawing' ? 'draw' : 'skeleton');
    const [pose, setPose] = useState<Pose>(character.pose || { type: 'skeleton', preset: 'full', data: createInitialSkeleton(0,0,MODAL_WIDTH, MODAL_HEIGHT), comment: '' });
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    const initialSkeleton = useMemo(() => {
        const charBox = { x: 0, y: 0, w: MODAL_WIDTH, h: MODAL_HEIGHT };
        const newSkeletonData: SkeletonData = {};

        if (character.pose?.type === 'skeleton') {
            const originalPose = character.pose;
            for (const key in originalPose.data) {
                const charPoint = originalPose.data[key as keyof SkeletonData];
                if (!charPoint) continue;
                
                const relativeX = (charPoint.x - character.x) / character.width;
                const relativeY = (charPoint.y - character.y) / character.height;
                
                newSkeletonData[key as keyof SkeletonData] = {
                    x: charBox.x + relativeX * charBox.w,
                    y: charBox.y + relativeY * charBox.h,
                };
            }
             return { ...originalPose, data: newSkeletonData };
        }
        return { type: 'skeleton' as const, preset: 'full' as const, data: createInitialSkeleton(charBox.x, charBox.y, charBox.w, charBox.h), comment: '' };

    }, [character]);
    
    useEffect(() => {
        setPose(initialSkeleton);
        // FIX: Correctly map all possible character pose types to the modal's mode state upon character change.
        setMode(character.pose?.type === 'image' ? 'upload' : character.pose?.type === 'drawing' ? 'draw' : 'skeleton');
    }, [character, initialSkeleton]);

    const handleSave = () => {
        onSave(character.id, pose);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPose({ type: 'image', href: reader.result as string });
            };
            reader.readAsDataURL(file);
        }
    };
    
    const SkeletonEditor = () => {
        const [skeletonPose, setSkeletonPose] = useState<SkeletonPose>(pose.type === 'skeleton' ? pose : initialSkeleton);
        const [draggingJoint, setDraggingJoint] = useState<string | null>(null);

        const handleMouseDown = (joint: string) => setDraggingJoint(joint);

        const handleMouseMove = (e: React.MouseEvent) => {
            if (!draggingJoint) return;
            const svg = e.currentTarget as SVGSVGElement;
            const rect = svg.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const newSkeletonData = { ...skeletonPose.data, [draggingJoint]: { x, y } };
            setSkeletonPose(prev => ({ ...prev, data: newSkeletonData }));
        };

        const handleMouseUp = () => {
            if(draggingJoint) {
                setPose(skeletonPose);
                setDraggingJoint(null);
            }
        };
        
        const changePreset = (preset: SkeletonPose['preset']) => {
            setSkeletonPose(prev => ({...prev, preset}));
            setPose(prev => ({...prev, type: 'skeleton', preset} as SkeletonPose));
        };

        return (
            <div className="flex flex-col gap-3">
                 <div className="flex flex-col gap-2">
                     <label className="text-xs font-semibold text-gray-500">Pose Preset</label>
                     <div className="grid grid-cols-2 gap-2 text-sm">
                         {(['full', 'upper', 'lower', 'face'] as const).map(p => (
                             <button key={p} onClick={() => changePreset(p)} className={`py-1 rounded-md font-semibold ${skeletonPose.preset === p ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}>{p.charAt(0).toUpperCase() + p.slice(1)}</button>
                         ))}
                     </div>
                 </div>
                 <div className="bg-gray-100 rounded-md border p-2 relative">
                    <svg width={MODAL_WIDTH} height={MODAL_HEIGHT} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
                        {skeletonConnections.map(([start, end]) => {
                           if(!skeletonPose.data[start] || !skeletonPose.data[end]) return null;
                           return <line key={`${start}-${end}`} x1={skeletonPose.data[start].x} y1={skeletonPose.data[start].y} x2={skeletonPose.data[end].x} y2={skeletonPose.data[end].y} stroke="#00BFFF" strokeWidth={4} strokeLinecap='round'/>
                        })}
                        {Object.entries(skeletonPose.data).map(([key, pos]) => {
                             if (!pos) return null;
                            return <circle key={key} cx={pos.x} cy={pos.y} r={8} fill={key === 'head' ? '#FF4500' : '#FF00FF'} stroke="white" strokeWidth={2} onMouseDown={() => handleMouseDown(key)} cursor="grab"/>
                        })}
                    </svg>
                 </div>
                 <div className="flex flex-col gap-2">
                     <label className="text-xs font-semibold text-gray-500">Pose Comment (for AI)</label>
                     <input type="text" value={skeletonPose.comment} onChange={e => setSkeletonPose(prev => ({...prev, comment: e.target.value}))} onBlur={() => setPose(skeletonPose)} placeholder="e.g., A dynamic pose swinging a sword" className="w-full bg-gray-100 border border-gray-300 p-2 text-sm rounded-md" />
                 </div>
            </div>
        )
    };
    
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <EditPoseIcon className="w-6 h-6 text-indigo-600" />
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Edit Character Pose</h3>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100"><XIcon className="w-5 h-5 text-gray-600" /></button>
                </div>
                <div className="p-4 flex-grow">
                    <div className="flex rounded-lg bg-gray-100 p-1 w-full text-sm font-semibold mb-4">
                        <button onClick={() => setMode('skeleton')} className={`w-1/3 p-2 rounded-md ${mode === 'skeleton' ? 'bg-white shadow' : 'text-gray-500'}`}>Skeleton</button>
                        <button onClick={() => setMode('upload')} className={`w-1/3 p-2 rounded-md ${mode === 'upload' ? 'bg-white shadow' : 'text-gray-500'}`}>Upload</button>
                        <button onClick={() => setMode('draw')} className={`w-1/3 p-2 rounded-md ${mode === 'draw' ? 'bg-white shadow' : 'text-gray-500'}`}>Draw</button>
                    </div>
                    {mode === 'skeleton' && <SkeletonEditor />}
                    {mode === 'upload' && (
                        <div className="flex flex-col items-center justify-center gap-4 h-full">
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden"/>
                            <div onClick={() => fileInputRef.current?.click()} className="cursor-pointer border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-indigo-500 w-full h-48 flex flex-col items-center justify-center">
                                {pose.type === 'image' && pose.href ? <img src={pose.href} alt="pose preview" className="max-h-full"/> : <><UploadIcon className="w-10 h-10 text-gray-400 mb-2" /><p>Click to upload an image</p></>}
                            </div>
                        </div>
                    )}
                     {mode === 'draw' && (
                        <div className="flex flex-col items-center justify-center gap-4 h-full">
                           <p className="text-sm text-gray-500">Drawing mode not implemented.</p>
                        </div>
                    )}
                </div>
                <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                    <button onClick={onClose} className="bg-white border border-gray-300 text-gray-700 font-semibold py-2 px-5 rounded-lg hover:bg-gray-100 transition-colors text-sm">Cancel</button>
                    <button onClick={handleSave} className="bg-indigo-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-indigo-500 transition-colors text-sm">Save Pose</button>
                </div>
            </div>
        </div>
    );
};