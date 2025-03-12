from manim import *


class Example(Scene):
    def construct(self):
        circle = Circle()
        self.play(Create(circle))
        self.wait(1)
        self.play(FadeOut(circle))
        self.wait(1)