import Spline from '@splinetool/react-spline';

export default function NeuralCore() {
    return (
        <div className="w-full h-full absolute inset-0 z-0">
            <Spline scene="https://prod.spline.design/6Wq1Q7YGyM-iab9i/scene.splinecode" />
            <div className="absolute inset-0 bg-gradient-to-t from-void via-transparent to-transparent pointer-events-none" />
        </div>
    );
}
